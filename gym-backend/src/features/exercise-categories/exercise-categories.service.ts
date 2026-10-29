import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/slug';
import { AppError } from '@/middlewares/errorHandler';

// Only links to live exercises count as "in use"; links to soft-deleted
// exercises shouldn't block cleaning up a category.
const inUse = { _count: { select: { exercises: { where: { exercise: { deletedAt: null } } } } } } as const;

export async function listCategories(withUsage = false) {
  return prisma.exerciseCategory.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
    ...(withUsage && { include: inUse }),
  });
}

export async function createCategory(name: string, description?: string) {
  const slug = slugify(name);
  const existing = await prisma.exerciseCategory.findFirst({
    where: { OR: [{ name: { equals: name, mode: 'insensitive' } }, { slug }] },
  });
  if (existing && !existing.deletedAt) throw new AppError('A category with this name already exists', 409);

  // Re-creating a deleted category brings the original row back.
  if (existing) {
    return prisma.exerciseCategory.update({
      where: { id: existing.id },
      data: { name, slug, description: description ?? null, deletedAt: null },
      include: inUse,
    });
  }

  return prisma.exerciseCategory.create({ data: { name, slug, description }, include: inUse });
}

export async function updateCategory(id: string, data: { name?: string; description?: string | null }) {
  const category = await prisma.exerciseCategory.findUnique({ where: { id } });
  if (!category || category.deletedAt) throw new AppError('Category not found', 404);

  const slug = data.name ? slugify(data.name) : undefined;
  if (data.name && slug !== category.slug) {
    const clash = await prisma.exerciseCategory.findFirst({
      where: { id: { not: id }, OR: [{ name: { equals: data.name, mode: 'insensitive' } }, { slug }] },
    });
    if (clash) throw new AppError('A category with this name already exists', 409);
  }

  return prisma.exerciseCategory.update({ where: { id }, data: { ...data, slug }, include: inUse });
}

// Refuses to delete a category that live exercises still use, so nothing loses
// its category silently.
export async function deleteCategory(id: string) {
  const category = await prisma.exerciseCategory.findUnique({ where: { id }, include: inUse });
  if (!category || category.deletedAt) throw new AppError('Category not found', 404);

  const used = category._count.exercises;
  if (used > 0) {
    throw new AppError(
      `This category is used by ${used} exercise${used === 1 ? '' : 's'}. Remove it from them first.`,
      409
    );
  }

  await prisma.exerciseCategory.update({ where: { id }, data: { deletedAt: new Date() } });
}
