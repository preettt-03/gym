import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/slug';
import { AppError } from '@/middlewares/errorHandler';

export async function listDietCategories() {
  return prisma.dietCategory.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } });
}

export async function createDietCategory(name: string, description?: string) {
  const slug = slugify(name);
  const existing = await prisma.dietCategory.findFirst({ where: { OR: [{ name }, { slug }] } });
  if (existing) throw new AppError('Category already exists', 409);

  return prisma.dietCategory.create({ data: { name, slug, description } });
}

export async function updateDietCategory(id: string, data: { name?: string; description?: string }) {
  const category = await prisma.dietCategory.findUnique({ where: { id } });
  if (!category || category.deletedAt) throw new AppError('Category not found', 404);

  return prisma.dietCategory.update({
    where: { id },
    data: { ...data, slug: data.name ? slugify(data.name) : undefined },
  });
}

export async function deleteDietCategory(id: string) {
  const category = await prisma.dietCategory.findUnique({ where: { id } });
  if (!category || category.deletedAt) throw new AppError('Category not found', 404);

  await prisma.dietCategory.update({ where: { id }, data: { deletedAt: new Date() } });
}
