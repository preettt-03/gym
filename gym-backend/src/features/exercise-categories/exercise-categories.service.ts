import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/slug';
import { AppError } from '@/middlewares/errorHandler';

export async function listCategories() {
  return prisma.exerciseCategory.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
  });
}

export async function createCategory(name: string, description?: string) {
  const slug = slugify(name);
  const existing = await prisma.exerciseCategory.findFirst({ where: { OR: [{ name }, { slug }] } });
  if (existing) throw new AppError('Category already exists', 409);

  return prisma.exerciseCategory.create({ data: { name, slug, description } });
}

export async function updateCategory(id: string, data: { name?: string; description?: string }) {
  const category = await prisma.exerciseCategory.findUnique({ where: { id } });
  if (!category || category.deletedAt) throw new AppError('Category not found', 404);

  return prisma.exerciseCategory.update({
    where: { id },
    data: {
      ...data,
      slug: data.name ? slugify(data.name) : undefined,
    },
  });
}

export async function deleteCategory(id: string) {
  const category = await prisma.exerciseCategory.findUnique({ where: { id } });
  if (!category || category.deletedAt) throw new AppError('Category not found', 404);

  await prisma.exerciseCategory.update({ where: { id }, data: { deletedAt: new Date() } });
}
