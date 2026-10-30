import { prisma } from '@/lib/prisma';
import { AppError } from '@/middlewares/errorHandler';

export async function listMyPayments(userId: string) {
  return prisma.payment.findMany({ where: { userId }, include: { plan: true }, orderBy: { createdAt: 'desc' } });
}

// Returns structured invoice data as JSON; see invoice-pdf.ts for the PDF rendering of this same data.
export async function getInvoice(userId: string, paymentId: string) {
  return buildInvoice(userId, paymentId);
}

// Shared by the member's own invoice download and the admin member page.
export async function buildInvoice(userId: string, paymentId: string) {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, userId },
    include: { plan: true, user: { select: { name: true, email: true } } },
  });
  if (!payment) throw new AppError('Payment not found', 404);

  return {
    invoiceNumber: payment.invoiceNumber,
    issuedAt: payment.createdAt,
    billedTo: payment.user,
    plan: { name: payment.plan.name, durationDays: payment.plan.durationDays },
    amount: payment.amount,
    currency: payment.currency,
    gateway: payment.gateway,
    status: payment.status,
    // Online gateway ids are internal; show references staff typed in (UTR etc.).
    reference: payment.recordedById ? payment.gatewayReferenceId : null,
  };
}
