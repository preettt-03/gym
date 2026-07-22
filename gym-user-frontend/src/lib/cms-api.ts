import { apiClient } from "@/lib/api-client";

export interface CmsPageContent {
  headline?: string;
  subtext?: string;
  bannerImageUrl?: string;
  ctaText?: string;
  body?: string;
  [key: string]: unknown;
}

export interface CmsPage {
  id: string;
  slug: string;
  title: string | null;
  content: CmsPageContent;
}

export async function getCmsPage(slug: string): Promise<CmsPage | null> {
  try {
    const { data } = await apiClient.get<{ page: CmsPage }>(`/cms/pages/${slug}`);
    return data.page;
  } catch {
    return null;
  }
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
}

export async function listFaqs() {
  const { data } = await apiClient.get<{ faqs: Faq[] }>("/cms/faqs");
  return data.faqs;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string | null;
  content: string;
  avatarUrl: string | null;
  rating: number | null;
}

export async function listTestimonials() {
  const { data } = await apiClient.get<{ testimonials: Testimonial[] }>("/cms/testimonials");
  return data.testimonials;
}

export interface BlogPostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  publishedAt: string;
}

export interface BlogPostDetail extends BlogPostSummary {
  content: string;
}

export async function listBlogPosts() {
  const { data } = await apiClient.get<{ posts: BlogPostSummary[] }>("/cms/blog");
  return data.posts;
}

export async function getBlogPost(slug: string) {
  const { data } = await apiClient.get<{ post: BlogPostDetail }>(`/cms/blog/${slug}`);
  return data.post;
}

export interface GalleryImage {
  id: string;
  imageUrl: string;
  caption: string | null;
}

export async function listGalleryImages() {
  const { data } = await apiClient.get<{ images: GalleryImage[] }>("/cms/gallery");
  return data.images;
}
