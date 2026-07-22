import { prisma } from '@/lib/prisma';
import { AppError } from '@/middlewares/errorHandler';
import { MembershipPlanInput, MembershipPlanUpdateInput } from '@/features/membership-plans/membership-plans.schemas';

export async function listActivePlans() {
  return prisma.membershipPlan.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { price: 'asc' },
  });
}

export async function listAllPlans() {
  return prisma.membershipPlan.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' } });
}

export async function createPlan(input: MembershipPlanInput) {
  return prisma.membershipPlan.create({ data: input });
}

export async function updatePlan(id: string, data: MembershipPlanUpdateInput) {
  const plan = await prisma.membershipPlan.findUnique({ where: { id } });
  if (!plan || plan.deletedAt) throw new AppError('Membership plan not found', 404);
  return prisma.membershipPlan.update({ where: { id }, data });
}

export async function deletePlan(id: string) {
  const plan = await prisma.membershipPlan.findUnique({ where: { id } });
  if (!plan || plan.deletedAt) throw new AppError('Membership plan not found', 404);
  await prisma.membershipPlan.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
}
