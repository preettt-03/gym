import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/slug';
import { AppError } from '@/middlewares/errorHandler';

// Only links to live diet plans count as "in use"; links to soft-deleted
// diet plans shouldn't block cleaning up a category.
const inUse = { _count: { select: { plans: { where: { dietPlan: { deletedAt: null } } } } } } as const;

export async function listDietCategories(withUsage = false) {
  return prisma.dietCategory.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
    ...(withUsage && { include: inUse }),
  });
}

export async function createDietCategory(name: string, description?: string) {
  const slug = slugify(name);
  const existing = await prisma.dietCategory.findFirst({
    where: { OR: [{ name: { equals: name, mode: 'insensitive' } }, { slug }] },
  });
  if (existing && !existing.deletedAt) throw new AppError('A category with this name already exists', 409);

  // Re-creating a deleted category brings the original row back.
  if (existing) {
    return prisma.dietCategory.update({
      where: { id: existing.id },
      data: { name, slug, description: description ?? null, deletedAt: null },
      include: inUse,
    });
  }

  return prisma.dietCategory.create({ data: { name, slug, description }, include: inUse });
}

export async function updateDietCategory(id: string, data: { name?: string; description?: string | null }) {
  const category = await prisma.dietCategory.findUnique({ where: { id } });
  if (!category || category.deletedAt) throw new AppError('Category not found', 404);

  const slug = data.name ? slugify(data.name) : undefined;
  if (data.name && slug !== category.slug) {
    const clash = await prisma.dietCategory.findFirst({
      where: { id: { not: id }, OR: [{ name: { equals: data.name, mode: 'insensitive' } }, { slug }] },
    });
    if (clash) throw new AppError('A category with this name already exists', 409);
  }

  return prisma.dietCategory.update({ where: { id }, data: { ...data, slug }, include: inUse });
}

// Refuses to delete a category that live diet plans still use, so nothing loses
// its category silently.
export async function deleteDietCategory(id: string) {
  const category = await prisma.dietCategory.findUnique({ where: { id }, include: inUse });
  if (!category || category.deletedAt) throw new AppError('Category not found', 404);

  const used = category._count.plans;
  if (used > 0) {
    throw new AppError(
      `This category is used by ${used} diet plan${used === 1 ? '' : 's'}. Remove it from them first.`,
      409
    );
  }

  await prisma.dietCategory.update({ where: { id }, data: { deletedAt: new Date() } });
}
