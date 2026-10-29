import { Difficulty, Exercise, ExerciseCategory, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/slug';
import { AppError } from '@/middlewares/errorHandler';
import { MUSCLE_GROUPS, MuscleGroup } from '@/lib/muscles';
import { PaginationParams } from '@/lib/pagination';
import { CreateExerciseInput, UpdateExerciseInput } from '@/features/exercises/exercises.schemas';

export interface ExerciseFilters {
  search?: string;
  category?: string;
  equipment?: string;
  difficulty?: Difficulty;
  targetMuscle?: string;
  muscleGroup?: MuscleGroup;
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
  if (filters.muscleGroup) {
    // An exercise belongs to a group by its primary muscle only, so "Legs" doesn't
    // list every move that merely engages the glutes.
    const muscles = [...MUSCLE_GROUPS[filters.muscleGroup]];
    where.AND = [{ OR: muscles.map((m) => ({ targetMuscle: { equals: m, mode: 'insensitive' as const } })) }];
  }
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

  if (userId) await recordView(userId, exercise.id);

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

  try {
    const updated = await prisma.exercise.update({
      where: { id },
      data: {
        ...rest,
        slug: rest.name ? slugify(rest.name) : undefined,
        // Replaced in the same statement, so a failed update can't leave the links half-cleared.
        categories: categoryIds ? { deleteMany: {}, create: categoryIds.map((categoryId) => ({ categoryId })) } : undefined,
      },
      include: includeCategories,
    });
    return serializeExercise(updated);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError('An exercise with this name already exists', 409);
    }
    throw err;
  }
}

export async function deleteExercise(id: string) {
  const exercise = await prisma.exercise.findUnique({ where: { id } });
  if (!exercise || exercise.deletedAt) throw new AppError('Exercise not found', 404);

  await prisma.exercise.update({ where: { id }, data: { deletedAt: new Date() } });
}

const VIEW_DEDUPE_MS = 5 * 60 * 1000;

// One row per visit; reloading the same page within a few minutes doesn't
// add another. Failures never block the page itself.
async function recordView(userId: string, exerciseId: string) {
  try {
    const recent = await prisma.exerciseView.findFirst({
      where: { userId, exerciseId, viewedAt: { gte: new Date(Date.now() - VIEW_DEDUPE_MS) } },
      select: { id: true },
    });
    if (recent) {
      await prisma.exerciseView.update({ where: { id: recent.id }, data: { viewedAt: new Date() } });
    } else {
      await prisma.exerciseView.create({ data: { userId, exerciseId } });
    }
  } catch {
    // View history is best-effort.
  }
}

async function assertLiveExercise(exerciseId: string) {
  const exercise = await prisma.exercise.findUnique({ where: { id: exerciseId }, select: { deletedAt: true } });
  if (!exercise || exercise.deletedAt) throw new AppError('Exercise not found', 404);
}

// Idempotent favourite/unfavourite: repeating the call (double clicks, two
// tabs) leaves the same state instead of flipping or hitting the unique key.
export async function setFavorite(userId: string, exerciseId: string, favorited: boolean) {
  await assertLiveExercise(exerciseId);
  if (favorited) {
    await prisma.exerciseFavorite.upsert({
      where: { userId_exerciseId: { userId, exerciseId } },
      create: { userId, exerciseId },
      update: {},
    });
  } else {
    await prisma.exerciseFavorite.deleteMany({ where: { userId, exerciseId } });
  }
  return { favorited };
}

// Kept for older clients; new UI uses setFavorite.
export async function toggleFavorite(userId: string, exerciseId: string) {
  const existing = await prisma.exerciseFavorite.findUnique({
    where: { userId_exerciseId: { userId, exerciseId } },
    select: { id: true },
  });
  return setFavorite(userId, exerciseId, !existing);
}

export async function listFavorites(userId: string) {
  const favorites = await prisma.exerciseFavorite.findMany({
    where: { userId, exercise: { deletedAt: null } },
    include: { exercise: { include: includeCategories } },
    orderBy: { createdAt: 'desc' },
  });

  return favorites.map((f) => serializeExercise(f.exercise));
}

// Most recent distinct exercises: group in the database first, then limit,
// so repeat views of one exercise can't crowd others out.
export async function listRecentlyViewed(userId: string, limit = 20) {
  const latest = await prisma.exerciseView.groupBy({
    by: ['exerciseId'],
    where: { userId, exercise: { deletedAt: null } },
    _max: { viewedAt: true },
    orderBy: { _max: { viewedAt: 'desc' } },
    take: limit,
  });

  const exercises = await prisma.exercise.findMany({
    where: { id: { in: latest.map((v) => v.exerciseId) } },
    include: includeCategories,
  });
  const byId = new Map(exercises.map((e) => [e.id, e]));

  return latest.flatMap((v) => {
    const exercise = byId.get(v.exerciseId);
    return exercise ? [{ ...serializeExercise(exercise), viewedAt: v._max.viewedAt }] : [];
  });
}

export async function clearRecentlyViewed(userId: string) {
  await prisma.exerciseView.deleteMany({ where: { userId } });
}
