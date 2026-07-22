import { z } from 'zod';

export const pageSlugSchema = z.object({
  params: z.object({ slug: z.string().min(1) }),
});

export const upsertPageSchema = z.object({
  params: z.object({ slug: z.string().min(1) }),
  body: z.object({
    title: z.string().optional(),
    content: z.record(z.string(), z.unknown()),
  }),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const createFaqSchema = z.object({
  body: z.object({
    question: z.string().min(1),
    answer: z.string().min(1),
    order: z.number().int().optional(),
  }),
});

export const updateFaqSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    question: z.string().min(1).optional(),
    answer: z.string().min(1).optional(),
    order: z.number().int().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const createTestimonialSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    role: z.string().optional(),
    content: z.string().min(1),
    avatarUrl: z.string().url().optional(),
    rating: z.number().int().min(1).max(5).optional(),
    order: z.number().int().optional(),
  }),
});

export const updateTestimonialSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().min(1).optional(),
    role: z.string().optional(),
    content: z.string().min(1).optional(),
    avatarUrl: z.string().url().optional(),
    rating: z.number().int().min(1).max(5).optional(),
    order: z.number().int().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const createBlogPostSchema = z.object({
  body: z.object({
    title: z.string().min(1),
    excerpt: z.string().optional(),
    content: z.string().min(1),
    coverImageUrl: z.string().url().optional(),
    isPublished: z.boolean().optional(),
  }),
});

export const updateBlogPostSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    title: z.string().min(1).optional(),
    excerpt: z.string().optional(),
    content: z.string().min(1).optional(),
    coverImageUrl: z.string().url().optional(),
    isPublished: z.boolean().optional(),
  }),
});

export const blogSlugSchema = z.object({
  params: z.object({ slug: z.string().min(1) }),
});

export const createGalleryImageSchema = z.object({
  body: z.object({
    imageUrl: z.string().url(),
    caption: z.string().optional(),
    order: z.number().int().optional(),
  }),
});
