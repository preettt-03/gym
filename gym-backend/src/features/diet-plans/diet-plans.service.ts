import { PlanSource, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/middlewares/errorHandler';
import { scaleNutrition } from '@/lib/nutrition';
import { DietPlanInput, DietPlanUpdateInput } from '@/features/diet-plans/diet-plans.schemas';

const planInclude = {
  categories: { include: { category: true } },
  meals: { include: { items: { include: { food: true } } } },
} satisfies Prisma.DietPlanInclude;

type PlanWithMeals = Prisma.DietPlanGetPayload<{ include: typeof planInclude }>;

function serializePlan(plan: PlanWithMeals) {
  return {
    ...plan,
    categories: plan.categories.map((c) => c.category),
    meals: plan.meals.map((meal) => ({
      ...meal,
      items: meal.items.map((item) => ({ ...item, nutrition: scaleNutrition(item.food, item.quantityGrams) })),
    })),
  };
}

function mealsCreateData(meals: DietPlanInput['meals']) {
  return meals.map((meal) => ({
    mealType: meal.mealType,
    title: meal.title,
    items: {
      create: meal.items.map((item) => ({
        foodId: item.foodId,
        quantityGrams: item.quantityGrams,
        notes: item.notes,
      })),
    },
  }));
}

// --- Admin ---

export async function createAdminDietPlan(adminId: string, input: DietPlanInput) {
  const { categoryIds, meals, ...rest } = input;
  const plan = await prisma.dietPlan.create({
    data: {
      ...rest,
      source: PlanSource.ADMIN,
      createdByAdminId: adminId,
      meals: { create: mealsCreateData(meals) },
      categories: categoryIds?.length ? { create: categoryIds.map((categoryId) => ({ categoryId })) } : undefined,
    },
    include: planInclude,
  });
  return serializePlan(plan);
}

export async function listAdminDietPlans() {
  return prisma.dietPlan.findMany({
    where: { source: PlanSource.ADMIN, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: { assignments: true, categories: { include: { category: true } } },
  });
}

export async function getAdminDietPlan(id: string) {
  const plan = await prisma.dietPlan.findFirst({
    where: { id, deletedAt: null },
    include: {
      ...planInclude,
      assignments: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });
  if (!plan) throw new AppError('Diet plan not found', 404);
  return serializePlan(plan);
}

export async function updateDietPlanMeta(id: string, data: DietPlanUpdateInput) {
  const plan = await prisma.dietPlan.findUnique({ where: { id } });
  if (!plan || plan.deletedAt) throw new AppError('Diet plan not found', 404);

  const { categoryIds, meals, ...meta } = data;

  if (meals) {
    await prisma.dietPlanMeal.deleteMany({ where: { dietPlanId: id } });
  }
  if (categoryIds) {
    await prisma.dietPlanCategoryLink.deleteMany({ where: { dietPlanId: id } });
  }

  const updated = await prisma.dietPlan.update({
    where: { id },
    data: {
      ...meta,
      meals: meals ? { create: mealsCreateData(meals) } : undefined,
      categories: categoryIds?.length ? { create: categoryIds.map((categoryId) => ({ categoryId })) } : undefined,
    },
    include: planInclude,
  });
  return serializePlan(updated);
}

export async function deleteDietPlan(id: string) {
  const plan = await prisma.dietPlan.findUnique({ where: { id } });
  if (!plan || plan.deletedAt) throw new AppError('Diet plan not found', 404);
  await prisma.dietPlan.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function assignDietPlan(planId: string, userIds: string[]) {
  const plan = await prisma.dietPlan.findUnique({ where: { id: planId } });
  if (!plan || plan.deletedAt || plan.source !== PlanSource.ADMIN) {
    throw new AppError('Admin diet plan not found', 404);
  }

  await prisma.$transaction(
    userIds.map((userId) =>
      prisma.dietPlanAssignment.upsert({
        where: { dietPlanId_userId: { dietPlanId: planId, userId } },
        update: { isActive: true },
        create: { dietPlanId: planId, userId },
      })
    )
  );
}

export async function unassignDietPlan(planId: string, userId: string) {
  await prisma.dietPlanAssignment.updateMany({
    where: { dietPlanId: planId, userId },
    data: { isActive: false },
  });
}

// --- User-facing ---

async function assertUserDietPlanAccess(planId: string, userId: string) {
  const plan = await prisma.dietPlan.findFirst({ where: { id: planId, deletedAt: null } });
  if (!plan) throw new AppError('Diet plan not found', 404);

  if (plan.source === PlanSource.USER) {
    if (plan.ownerId !== userId) throw new AppError('Forbidden', 403);
    return plan;
  }

  const assignment = await prisma.dietPlanAssignment.findUnique({
    where: { dietPlanId_userId: { dietPlanId: planId, userId } },
  });
  if (!assignment || !assignment.isActive) throw new AppError('Forbidden', 403);
  return plan;
}

export async function listMyDietPlans(userId: string) {
  const [owned, assignments] = await Promise.all([
    prisma.dietPlan.findMany({
      where: { source: PlanSource.USER, ownerId: userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.dietPlanAssignment.findMany({
      where: { userId, isActive: true, dietPlan: { deletedAt: null } },
      include: { dietPlan: true },
      orderBy: { assignedAt: 'desc' },
    }),
  ]);

  return { ownedPlans: owned, assignedPlans: assignments.map((a) => a.dietPlan) };
}

// A diet plan's meals aren't split by day — the same meal list repeats every
// day — so "today's diet" is simply the active plan's full meal list.
export async function getActiveDietPlan(userId: string) {
  const assignment = await prisma.dietPlanAssignment.findFirst({
    where: { userId, isActive: true, dietPlan: { deletedAt: null } },
    orderBy: { assignedAt: 'desc' },
  });

  const planId =
    assignment?.dietPlanId ??
    (
      await prisma.dietPlan.findFirst({
        where: { source: PlanSource.USER, ownerId: userId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      })
    )?.id;

  if (!planId) return null;

  const plan = await prisma.dietPlan.findUnique({ where: { id: planId }, include: planInclude });
  if (!plan) return null;

  return serializePlan(plan);
}

export async function createUserDietPlan(userId: string, input: DietPlanInput) {
  const { categoryIds, meals, ...rest } = input;
  const plan = await prisma.dietPlan.create({
    data: {
      ...rest,
      source: PlanSource.USER,
      ownerId: userId,
      meals: { create: mealsCreateData(meals) },
      categories: categoryIds?.length ? { create: categoryIds.map((categoryId) => ({ categoryId })) } : undefined,
    },
    include: planInclude,
  });
  return serializePlan(plan);
}

export async function getMyDietPlan(planId: string, userId: string) {
  await assertUserDietPlanAccess(planId, userId);
  const plan = await prisma.dietPlan.findUnique({ where: { id: planId }, include: planInclude });
  if (!plan) throw new AppError('Diet plan not found', 404);
  return serializePlan(plan);
}

export async function updateMyDietPlan(planId: string, userId: string, data: DietPlanUpdateInput) {
  const plan = await prisma.dietPlan.findUnique({ where: { id: planId } });
  if (!plan || plan.deletedAt || plan.source !== PlanSource.USER || plan.ownerId !== userId) {
    throw new AppError('Diet plan not found', 404);
  }
  return updateDietPlanMeta(planId, data);
}

export async function deleteMyDietPlan(planId: string, userId: string) {
  const plan = await prisma.dietPlan.findUnique({ where: { id: planId } });
  if (!plan || plan.deletedAt || plan.source !== PlanSource.USER || plan.ownerId !== userId) {
    throw new AppError('Diet plan not found', 404);
  }
  await deleteDietPlan(planId);
}
