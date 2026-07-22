import { Response, Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { validate } from '@/middlewares/validate';
import { AuthedRequest, requireAuth, requireRole } from '@/middlewares/auth';
import * as schemas from '@/features/cms/cms.schemas';
import * as service from '@/features/cms/cms.service';

// Public: /api/v1/cms
export const cmsRouter = Router();

cmsRouter.get(
  '/pages/:slug',
  validate(schemas.pageSlugSchema),
  asyncHandler(async (req, res) => res.json({ page: await service.getPage(req.params.slug) }))
);
cmsRouter.get(
  '/faqs',
  asyncHandler(async (_req, res) => res.json({ faqs: await service.listFaqs() }))
);
cmsRouter.get(
  '/testimonials',
  asyncHandler(async (_req, res) => res.json({ testimonials: await service.listTestimonials() }))
);
cmsRouter.get(
  '/blog',
  asyncHandler(async (_req, res) => res.json({ posts: await service.listPublishedBlogPosts() }))
);
cmsRouter.get(
  '/blog/:slug',
  validate(schemas.blogSlugSchema),
  asyncHandler(async (req, res) => res.json({ post: await service.getBlogPostBySlug(req.params.slug) }))
);
cmsRouter.get(
  '/gallery',
  asyncHandler(async (_req, res) => res.json({ images: await service.listGalleryImages() }))
);

// Admin: /api/v1/admin/cms
export const adminCmsRouter = Router();
adminCmsRouter.use(requireAuth, requireRole(Role.ADMIN));

adminCmsRouter.put(
  '/pages/:slug',
  validate(schemas.upsertPageSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const page = await service.upsertPage(req.params.slug, req.user!.id, req.body.title, req.body.content);
    res.json({ page });
  })
);

adminCmsRouter.get(
  '/faqs',
  asyncHandler(async (_req, res) => res.json({ faqs: await service.listAllFaqs() }))
);
adminCmsRouter.post(
  '/faqs',
  validate(schemas.createFaqSchema),
  asyncHandler(async (req, res) => res.status(201).json({ faq: await service.createFaq(req.body) }))
);
adminCmsRouter.patch(
  '/faqs/:id',
  validate(schemas.updateFaqSchema),
  asyncHandler(async (req, res) => res.json({ faq: await service.updateFaq(req.params.id, req.body) }))
);
adminCmsRouter.delete(
  '/faqs/:id',
  validate(schemas.idParamSchema),
  asyncHandler(async (req, res) => {
    await service.deleteFaq(req.params.id);
    res.status(204).send();
  })
);

adminCmsRouter.get(
  '/testimonials',
  asyncHandler(async (_req, res) => res.json({ testimonials: await service.listAllTestimonials() }))
);
adminCmsRouter.post(
  '/testimonials',
  validate(schemas.createTestimonialSchema),
  asyncHandler(async (req, res) => res.status(201).json({ testimonial: await service.createTestimonial(req.body) }))
);
adminCmsRouter.patch(
  '/testimonials/:id',
  validate(schemas.updateTestimonialSchema),
  asyncHandler(async (req, res) => res.json({ testimonial: await service.updateTestimonial(req.params.id, req.body) }))
);
adminCmsRouter.delete(
  '/testimonials/:id',
  validate(schemas.idParamSchema),
  asyncHandler(async (req, res) => {
    await service.deleteTestimonial(req.params.id);
    res.status(204).send();
  })
);

adminCmsRouter.get(
  '/blog',
  asyncHandler(async (_req, res) => res.json({ posts: await service.listAllBlogPosts() }))
);
adminCmsRouter.post(
  '/blog',
  validate(schemas.createBlogPostSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) =>
    res.status(201).json({ post: await service.createBlogPost(req.user!.id, req.body) })
  )
);
adminCmsRouter.patch(
  '/blog/:id',
  validate(schemas.updateBlogPostSchema),
  asyncHandler(async (req, res) => res.json({ post: await service.updateBlogPost(req.params.id, req.body) }))
);
adminCmsRouter.delete(
  '/blog/:id',
  validate(schemas.idParamSchema),
  asyncHandler(async (req, res) => {
    await service.deleteBlogPost(req.params.id);
    res.status(204).send();
  })
);

adminCmsRouter.post(
  '/gallery',
  validate(schemas.createGalleryImageSchema),
  asyncHandler(async (req, res) => res.status(201).json({ image: await service.addGalleryImage(req.body) }))
);
adminCmsRouter.delete(
  '/gallery/:id',
  validate(schemas.idParamSchema),
  asyncHandler(async (req, res) => {
    await service.deleteGalleryImage(req.params.id);
    res.status(204).send();
  })
);
