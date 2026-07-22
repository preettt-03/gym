import { MembershipStatus, PaymentGateway, PaymentStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/middlewares/errorHandler';
import { isRazorpayConfigured, razorpay, verifyRazorpaySignature } from '@/features/memberships/razorpay';

function computeFinalPrice(price: number, discountPercent: number | null): number {
  if (!discountPercent) return price;
  return Number((price - price * (discountPercent / 100)).toFixed(2));
}

function generateInvoiceNumber(): string {
  return `INV-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

// Lazily flips an expired-but-still-marked-ACTIVE membership to EXPIRED on read,
// so status is always correct without needing a scheduled job for v1.
export async function getEffectiveMembership(userId: string) {
  const membership = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { endDate: 'desc' },
    include: { plan: true },
  });
  if (!membership) return null;

  if (membership.status === MembershipStatus.ACTIVE && membership.endDate < new Date()) {
    return prisma.membership.update({
      where: { id: membership.id },
      data: { status: MembershipStatus.EXPIRED },
      include: { plan: true },
    });
  }

  return membership;
}

export async function getMyMembershipStatus(userId: string) {
  const membership = await getEffectiveMembership(userId);
  return {
    hasMembership: Boolean(membership),
    isActive: membership?.status === MembershipStatus.ACTIVE,
    membership,
  };
}

// Shared by both the real Razorpay flow (after signature verification) and the
// no-gateway-configured demo fallback — creates or extends the membership and
// marks/creates its Payment row as COMPLETED.
async function activateMembership(
  userId: string,
  planId: string,
  finalPrice: number,
  gateway: PaymentGateway,
  gatewayReferenceId: string,
  existingPaymentId?: string
) {
  const plan = await prisma.membershipPlan.findFirst({ where: { id: planId, isActive: true, deletedAt: null } });
  if (!plan) throw new AppError('Membership plan not found', 404);

  const existing = await getEffectiveMembership(userId);
  const isRenewal = existing?.status === MembershipStatus.ACTIVE;
  const startDate = isRenewal ? existing!.endDate : new Date();
  const endDate = new Date(startDate.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

  const membership = isRenewal
    ? await prisma.membership.update({ where: { id: existing!.id }, data: { endDate, planId: plan.id } })
    : await prisma.membership.create({
        data: { userId, planId: plan.id, startDate, endDate, status: MembershipStatus.ACTIVE },
      });

  const payment = existingPaymentId
    ? await prisma.payment.update({
        where: { id: existingPaymentId },
        data: {
          membershipId: membership.id,
          status: PaymentStatus.COMPLETED,
          gatewayReferenceId,
          invoiceNumber: generateInvoiceNumber(),
        },
      })
    : await prisma.payment.create({
        data: {
          userId,
          membershipId: membership.id,
          planId: plan.id,
          amount: finalPrice,
          gateway,
          status: PaymentStatus.COMPLETED,
          gatewayReferenceId,
          invoiceNumber: generateInvoiceNumber(),
        },
      });

  return { membership, payment, isRenewal };
}

// No RAZORPAY_KEY_ID/SECRET configured — instant, clearly-labeled demo
// completion so membership purchase still works end-to-end for local dev/demo.
async function checkoutDemo(userId: string, planId: string, gateway: PaymentGateway) {
  const plan = await prisma.membershipPlan.findFirst({ where: { id: planId, isActive: true, deletedAt: null } });
  if (!plan) throw new AppError('Membership plan not found', 404);

  const finalPrice = computeFinalPrice(plan.price, plan.discountPercent);
  const result = await activateMembership(userId, planId, finalPrice, gateway, `DEMO-${Date.now()}`);
  return { ...result, requiresPayment: false, demo: true };
}

// Real flow: create a Razorpay order and a PENDING payment row; the membership
// itself is only activated once verifyPayment() confirms a valid signature —
// never on the strength of the client alone.
async function checkoutWithRazorpay(userId: string, planId: string) {
  const plan = await prisma.membershipPlan.findFirst({ where: { id: planId, isActive: true, deletedAt: null } });
  if (!plan) throw new AppError('Membership plan not found', 404);

  const finalPrice = computeFinalPrice(plan.price, plan.discountPercent);
  const amountPaise = Math.round(finalPrice * 100);

  const order = await razorpay!.orders.create({
    amount: amountPaise,
    currency: 'INR',
    // Razorpay caps receipt at 40 chars — a full plan UUID + timestamp
    // overflows that, so use a short random receipt and keep the real
    // ids in `notes` instead.
    receipt: `rcpt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    notes: { userId, planId },
  });

  const payment = await prisma.payment.create({
    data: {
      userId,
      planId: plan.id,
      amount: finalPrice,
      gateway: PaymentGateway.RAZORPAY,
      status: PaymentStatus.PENDING,
      gatewayReferenceId: String(order.id),
    },
  });

  return {
    requiresPayment: true,
    demo: false,
    paymentId: payment.id,
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
  };
}

export async function checkout(userId: string, planId: string, gateway: PaymentGateway) {
  if (isRazorpayConfigured && gateway === PaymentGateway.RAZORPAY) {
    return checkoutWithRazorpay(userId, planId);
  }
  return checkoutDemo(userId, planId, gateway);
}

export async function verifyPayment(
  userId: string,
  input: { paymentId: string; razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }
) {
  if (!isRazorpayConfigured) throw new AppError('Razorpay is not configured', 501);

  const payment = await prisma.payment.findFirst({ where: { id: input.paymentId, userId } });
  if (!payment) throw new AppError('Payment not found', 404);
  if (payment.status !== PaymentStatus.PENDING) throw new AppError('Payment already processed', 409);
  if (payment.gatewayReferenceId !== input.razorpayOrderId) throw new AppError('Order mismatch', 400);

  const valid = verifyRazorpaySignature(input.razorpayOrderId, input.razorpayPaymentId, input.razorpaySignature);
  if (!valid) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.FAILED } });
    throw new AppError('Payment signature verification failed', 400);
  }

  const result = await activateMembership(
    userId,
    payment.planId,
    payment.amount,
    PaymentGateway.RAZORPAY,
    input.razorpayPaymentId,
    payment.id
  );

  return { ...result, requiresPayment: false, demo: false };
}
