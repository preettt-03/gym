import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/slug';
import { AppError } from '@/middlewares/errorHandler';
import { PaginationParams } from '@/lib/pagination';
import { MACROS_TOO_HIGH, macrosFit } from '@/features/foods/foods.schemas';

interface FoodInput {
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g?: number | null;
  sugarPer100g?: number | null;
  sodiumMgPer100g?: number | null;
}

// Admin listings also report where each food is referenced, so the UI can
// warn before removing one that members have logged.
const usageCount = { _count: { select: { nutritionLogs: true, mealItems: true } } } as const;

export async function listFoods(search: string | undefined, pagination: PaginationParams, withUsage = false) {
  const where: Prisma.FoodWhereInput = { deletedAt: null };
  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }

  const [items, total] = await Promise.all([
    prisma.food.findMany({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: { name: 'asc' },
      ...(withUsage && { include: usageCount }),
    }),
    prisma.food.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    },
  };
}

export async function getFood(id: string) {
  const food = await prisma.food.findFirst({ where: { id, deletedAt: null } });
  if (!food) throw new AppError('Food not found', 404);
  return food;
}

export async function createFood(input: FoodInput) {
  const slug = slugify(input.name);
  const existing = await prisma.food.findUnique({ where: { slug } });
  if (existing && !existing.deletedAt) throw new AppError('A food with this name already exists', 409);

  // Re-adding a previously deleted food restores it (keeping its history)
  // instead of failing on the unique slug.
  if (existing) {
    return prisma.food.update({
      where: { id: existing.id },
      data: { fiberPer100g: null, sugarPer100g: null, sodiumMgPer100g: null, ...input, deletedAt: null },
      include: usageCount,
    });
  }

  return prisma.food.create({ data: { ...input, slug }, include: usageCount });
}

export async function updateFood(id: string, input: Partial<FoodInput>) {
  const food = await prisma.food.findUnique({ where: { id } });
  if (!food || food.deletedAt) throw new AppError('Food not found', 404);

  if (!macrosFit({ ...food, ...input })) throw new AppError(MACROS_TOO_HIGH, 422);

  const slug = input.name ? slugify(input.name) : undefined;
  if (slug && slug !== food.slug) {
    const clash = await prisma.food.findUnique({ where: { slug } });
    if (clash) throw new AppError('A food with this name already exists', 409);
  }

  return prisma.food.update({ where: { id }, data: { ...input, slug }, include: usageCount });
}

// Soft delete: existing nutrition logs and diet plans keep pointing at the
// food, it just stops appearing in search for new entries.
export async function deleteFood(id: string) {
  const food = await prisma.food.findUnique({ where: { id } });
  if (!food || food.deletedAt) throw new AppError('Food not found', 404);

  await prisma.food.update({ where: { id }, data: { deletedAt: new Date() } });
}
