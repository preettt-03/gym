import { MembershipStatus, PaymentGateway, PaymentStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/middlewares/errorHandler';

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

/**
 * NOTE: This simulates a successful payment. A real Razorpay/Stripe integration would create a
 * payment intent/order here, return client-side checkout params, and only activate the
 * membership once a signed webhook confirms payment (status starting PENDING, not COMPLETED).
 * No payment gateway credentials are configured yet, so this is a stand-in for that flow.
 */
export async function checkout(userId: string, planId: string, gateway: PaymentGateway) {
  const plan = await prisma.membershipPlan.findFirst({ where: { id: planId, isActive: true, deletedAt: null } });
  if (!plan) throw new AppError('Membership plan not found', 404);

  const finalPrice = computeFinalPrice(plan.price, plan.discountPercent);

  const existing = await getEffectiveMembership(userId);
  const isRenewal = existing?.status === MembershipStatus.ACTIVE;
  const startDate = isRenewal ? existing!.endDate : new Date();
  const endDate = new Date(startDate.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

  const membership = isRenewal
    ? await prisma.membership.update({ where: { id: existing!.id }, data: { endDate, planId: plan.id } })
    : await prisma.membership.create({
        data: { userId, planId: plan.id, startDate, endDate, status: MembershipStatus.ACTIVE },
      });

  const payment = await prisma.payment.create({
    data: {
      userId,
      membershipId: membership.id,
      planId: plan.id,
      amount: finalPrice,
      gateway,
      status: PaymentStatus.COMPLETED,
      gatewayReferenceId: `SIMULATED-${Date.now()}`,
      invoiceNumber: generateInvoiceNumber(),
    },
  });

  return { membership, payment, isRenewal };
}
