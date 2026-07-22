import { Difficulty, Exercise, ExerciseCategory, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/slug';
import { AppError } from '@/middlewares/errorHandler';
import { PaginationParams } from '@/lib/pagination';
import { CreateExerciseInput, UpdateExerciseInput } from '@/features/exercises/exercises.schemas';

export interface ExerciseFilters {
  search?: string;
  category?: string;
  equipment?: string;
  difficulty?: Difficulty;
  targetMuscle?: string;
  workoutType?: string;
  minCalories?: number;
  maxCalories?: number;
  minDuration?: number;
  maxDuration?: number;
}

type ExerciseWithCategories = Exercise & {
  categories: { category: ExerciseCategory }[];
};

function serializeExercise(exercise: ExerciseWithCategories) {
  const { categories, ...rest } = exercise;
  return { ...rest, categories: categories.map((link) => link.category) };
}

const includeCategories = {
  categories: { include: { category: true } },
} satisfies Prisma.ExerciseInclude;

function buildWhere(filters: ExerciseFilters): Prisma.ExerciseWhereInput {
  const where: Prisma.ExerciseWhereInput = { deletedAt: null };

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { targetMuscle: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  if (filters.category) {
    where.categories = { some: { category: { slug: filters.category } } };
  }
  if (filters.equipment) {
    where.equipment = { hasSome: filters.equipment.split(',').map((e) => e.trim()) };
  }
  if (filters.difficulty) where.difficulty = filters.difficulty;
  if (filters.targetMuscle) where.targetMuscle = { equals: filters.targetMuscle, mode: 'insensitive' };
  if (filters.workoutType) where.workoutType = { equals: filters.workoutType, mode: 'insensitive' };
  if (filters.minCalories !== undefined || filters.maxCalories !== undefined) {
    where.caloriesBurnedEstimate = {
      gte: filters.minCalories,
      lte: filters.maxCalories,
    };
  }
  if (filters.minDuration !== undefined || filters.maxDuration !== undefined) {
    where.durationMinutes = {
      gte: filters.minDuration,
      lte: filters.maxDuration,
    };
  }

  return where;
}

export async function listExercises(filters: ExerciseFilters, pagination: PaginationParams) {
  const where = buildWhere(filters);

  const [items, total] = await Promise.all([
    prisma.exercise.findMany({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: { createdAt: 'desc' },
      include: includeCategories,
    }),
    prisma.exercise.count({ where }),
  ]);

  return {
    items: items.map(serializeExercise),
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    },
  };
}

export async function getExerciseBySlug(slug: string, userId?: string) {
  const exercise = await prisma.exercise.findFirst({
    where: { slug, deletedAt: null },
    include: includeCategories,
  });
  if (!exercise) throw new AppError('Exercise not found', 404);

  if (userId) {
    await prisma.exerciseView.create({ data: { userId, exerciseId: exercise.id } }).catch(() => undefined);
  }

  return serializeExercise(exercise);
}

export async function createExercise(data: CreateExerciseInput) {
  const { categoryIds, ...rest } = data;
  const slug = slugify(data.name);

  const existing = await prisma.exercise.findUnique({ where: { slug } });
  if (existing) throw new AppError('An exercise with this name already exists', 409);

  const exercise = await prisma.exercise.create({
    data: {
      ...rest,
      slug,
      categories: categoryIds?.length
        ? { create: categoryIds.map((categoryId) => ({ categoryId })) }
        : undefined,
    },
    include: includeCategories,
  });

  return serializeExercise(exercise);
}

export async function updateExercise(id: string, data: UpdateExerciseInput) {
  const exercise = await prisma.exercise.findUnique({ where: { id } });
  if (!exercise || exercise.deletedAt) throw new AppError('Exercise not found', 404);

  const { categoryIds, ...rest } = data;

  if (categoryIds) {
    await prisma.exerciseCategoryLink.deleteMany({ where: { exerciseId: id } });
  }

  const updated = await prisma.exercise.update({
    where: { id },
    data: {
      ...rest,
      slug: rest.name ? slugify(rest.name) : undefined,
      categories: categoryIds?.length
        ? { create: categoryIds.map((categoryId) => ({ categoryId })) }
        : undefined,
    },
    include: includeCategories,
  });

  return serializeExercise(updated);
}

export async function deleteExercise(id: string) {
  const exercise = await prisma.exercise.findUnique({ where: { id } });
  if (!exercise || exercise.deletedAt) throw new AppError('Exercise not found', 404);

  await prisma.exercise.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function toggleFavorite(userId: string, exerciseId: string) {
  const exercise = await prisma.exercise.findUnique({ where: { id: exerciseId } });
  if (!exercise || exercise.deletedAt) throw new AppError('Exercise not found', 404);

  const existing = await prisma.exerciseFavorite.findUnique({
    where: { userId_exerciseId: { userId, exerciseId } },
  });

  if (existing) {
    await prisma.exerciseFavorite.delete({ where: { id: existing.id } });
    return { favorited: false };
  }

  await prisma.exerciseFavorite.create({ data: { userId, exerciseId } });
  return { favorited: true };
}

export async function listFavorites(userId: string) {
  const favorites = await prisma.exerciseFavorite.findMany({
    where: { userId },
    include: { exercise: { include: includeCategories } },
    orderBy: { createdAt: 'desc' },
  });

  return favorites.map((f) => serializeExercise(f.exercise));
}

export async function listRecentlyViewed(userId: string, limit = 20) {
  const views = await prisma.exerciseView.findMany({
    where: { userId },
    include: { exercise: { include: includeCategories } },
    orderBy: { viewedAt: 'desc' },
    take: limit,
    distinct: ['exerciseId'],
  });

  return views.map((v) => serializeExercise(v.exercise));
}
