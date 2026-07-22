import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/slug';
import { AppError } from '@/middlewares/errorHandler';
import { PaginationParams } from '@/lib/pagination';

interface FoodInput {
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g?: number;
  sugarPer100g?: number;
  sodiumMgPer100g?: number;
}

export async function listFoods(search: string | undefined, pagination: PaginationParams) {
  const where: Prisma.FoodWhereInput = { deletedAt: null };
  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }

  const [items, total] = await Promise.all([
    prisma.food.findMany({ where, skip: pagination.skip, take: pagination.limit, orderBy: { name: 'asc' } }),
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
  if (existing) throw new AppError('A food with this name already exists', 409);

  return prisma.food.create({ data: { ...input, slug } });
}

export async function updateFood(id: string, input: Partial<FoodInput>) {
  const food = await prisma.food.findUnique({ where: { id } });
  if (!food || food.deletedAt) throw new AppError('Food not found', 404);

  return prisma.food.update({
    where: { id },
    data: { ...input, slug: input.name ? slugify(input.name) : undefined },
  });
}

export async function deleteFood(id: string) {
  const food = await prisma.food.findUnique({ where: { id } });
  if (!food || food.deletedAt) throw new AppError('Food not found', 404);

  await prisma.food.update({ where: { id }, data: { deletedAt: new Date() } });
}
