import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/slug';
import { AppError } from '@/middlewares/errorHandler';

// --- Pages (home banner, about, pricing, ...) ---

export async function getPage(slug: string) {
  const page = await prisma.cmsPage.findUnique({ where: { slug } });
  if (!page) throw new AppError('Page not found', 404);
  return page;
}

export async function upsertPage(slug: string, adminId: string, title: string | undefined, content: Prisma.InputJsonValue) {
  return prisma.cmsPage.upsert({
    where: { slug },
    update: { title, content, updatedByAdminId: adminId },
    create: { slug, title, content, updatedByAdminId: adminId },
  });
}

// --- FAQs ---

export async function listFaqs() {
  return prisma.faq.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } });
}

export async function listAllFaqs() {
  return prisma.faq.findMany({ orderBy: { order: 'asc' } });
}

export async function createFaq(input: { question: string; answer: string; order?: number }) {
  return prisma.faq.create({ data: input });
}

export async function updateFaq(id: string, data: Partial<{ question: string; answer: string; order: number; isActive: boolean }>) {
  const faq = await prisma.faq.findUnique({ where: { id } });
  if (!faq) throw new AppError('FAQ not found', 404);
  return prisma.faq.update({ where: { id }, data });
}

export async function deleteFaq(id: string) {
  const faq = await prisma.faq.findUnique({ where: { id } });
  if (!faq) throw new AppError('FAQ not found', 404);
  await prisma.faq.delete({ where: { id } });
}

// --- Testimonials ---

export async function listTestimonials() {
  return prisma.testimonial.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } });
}

export async function listAllTestimonials() {
  return prisma.testimonial.findMany({ orderBy: { order: 'asc' } });
}

interface TestimonialInput {
  name: string;
  role?: string;
  content: string;
  avatarUrl?: string;
  rating?: number;
  order?: number;
}

export async function createTestimonial(input: TestimonialInput) {
  return prisma.testimonial.create({ data: input });
}

export async function updateTestimonial(id: string, data: Partial<TestimonialInput> & { isActive?: boolean }) {
  const testimonial = await prisma.testimonial.findUnique({ where: { id } });
  if (!testimonial) throw new AppError('Testimonial not found', 404);
  return prisma.testimonial.update({ where: { id }, data });
}

export async function deleteTestimonial(id: string) {
  const testimonial = await prisma.testimonial.findUnique({ where: { id } });
  if (!testimonial) throw new AppError('Testimonial not found', 404);
  await prisma.testimonial.delete({ where: { id } });
}

// --- Blog posts ---

export async function listPublishedBlogPosts() {
  return prisma.blogPost.findMany({
    where: { isPublished: true },
    orderBy: { publishedAt: 'desc' },
    select: { id: true, title: true, slug: true, excerpt: true, coverImageUrl: true, publishedAt: true },
  });
}

export async function getBlogPostBySlug(slug: string) {
  const post = await prisma.blogPost.findFirst({ where: { slug, isPublished: true } });
  if (!post) throw new AppError('Post not found', 404);
  return post;
}

export async function listAllBlogPosts() {
  return prisma.blogPost.findMany({ orderBy: { createdAt: 'desc' } });
}

interface BlogPostInput {
  title: string;
  excerpt?: string;
  content: string;
  coverImageUrl?: string;
  isPublished?: boolean;
}

export async function createBlogPost(adminId: string, input: BlogPostInput) {
  const slug = slugify(input.title);
  const existing = await prisma.blogPost.findUnique({ where: { slug } });
  if (existing) throw new AppError('A post with this title already exists', 409);

  return prisma.blogPost.create({
    data: {
      ...input,
      slug,
      authorAdminId: adminId,
      publishedAt: input.isPublished ? new Date() : null,
    },
  });
}

export async function updateBlogPost(id: string, data: Partial<BlogPostInput>) {
  const post = await prisma.blogPost.findUnique({ where: { id } });
  if (!post) throw new AppError('Post not found', 404);

  return prisma.blogPost.update({
    where: { id },
    data: {
      ...data,
      slug: data.title ? slugify(data.title) : undefined,
      publishedAt: data.isPublished && !post.isPublished ? new Date() : undefined,
    },
  });
}

export async function deleteBlogPost(id: string) {
  const post = await prisma.blogPost.findUnique({ where: { id } });
  if (!post) throw new AppError('Post not found', 404);
  await prisma.blogPost.delete({ where: { id } });
}

// --- Gallery ---

export async function listGalleryImages() {
  return prisma.galleryImage.findMany({ orderBy: { order: 'asc' } });
}

export async function addGalleryImage(input: { imageUrl: string; caption?: string; order?: number }) {
  return prisma.galleryImage.create({ data: input });
}

export async function deleteGalleryImage(id: string) {
  const image = await prisma.galleryImage.findUnique({ where: { id } });
  if (!image) throw new AppError('Image not found', 404);
  await prisma.galleryImage.delete({ where: { id } });
}
