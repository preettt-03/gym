import { apiClient } from "@/lib/api-client";

export async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post<{ url: string }>("/uploads", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.url;
}

// --- Pages ---

export interface CmsHomeContent {
  headline?: string;
  subtext?: string;
  bannerImageUrl?: string;
  ctaText?: string;
}

export interface CmsPage {
  id: string;
  slug: string;
  title: string | null;
  content: CmsHomeContent;
  updatedAt: string;
}

export async function getPage(slug: string) {
  const { data } = await apiClient.get<{ page: CmsPage }>(`/cms/pages/${slug}`).catch(() => ({
    data: { page: null as CmsPage | null },
  }));
  return data.page;
}

export async function upsertPage(slug: string, input: { title?: string; content: CmsHomeContent }) {
  const { data } = await apiClient.put<{ page: CmsPage }>(`/admin/cms/pages/${slug}`, input);
  return data.page;
}

// --- FAQs ---

export interface Faq {
  id: string;
  question: string;
  answer: string;
  order: number;
  isActive: boolean;
}

export async function listAdminFaqs() {
  const { data } = await apiClient.get<{ faqs: Faq[] }>("/admin/cms/faqs");
  return data.faqs;
}

export async function createFaq(input: { question: string; answer: string }) {
  const { data } = await apiClient.post<{ faq: Faq }>("/admin/cms/faqs", input);
  return data.faq;
}

export async function deleteFaq(id: string) {
  await apiClient.delete(`/admin/cms/faqs/${id}`);
}

// --- Testimonials ---

export interface Testimonial {
  id: string;
  name: string;
  role: string | null;
  content: string;
  rating: number | null;
}

export async function listAdminTestimonials() {
  const { data } = await apiClient.get<{ testimonials: Testimonial[] }>("/admin/cms/testimonials");
  return data.testimonials;
}

export async function createTestimonial(input: { name: string; role?: string; content: string; rating?: number }) {
  const { data } = await apiClient.post<{ testimonial: Testimonial }>("/admin/cms/testimonials", input);
  return data.testimonial;
}

export async function deleteTestimonial(id: string) {
  await apiClient.delete(`/admin/cms/testimonials/${id}`);
}

// --- Blog ---

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImageUrl: string | null;
  isPublished: boolean;
}

export async function listAdminBlogPosts() {
  const { data } = await apiClient.get<{ posts: BlogPost[] }>("/admin/cms/blog");
  return data.posts;
}

export async function createBlogPost(input: { title: string; content: string; excerpt?: string }) {
  const { data } = await apiClient.post<{ post: BlogPost }>("/admin/cms/blog", input);
  return data.post;
}

export async function togglePublishBlogPost(id: string, isPublished: boolean) {
  const { data } = await apiClient.patch<{ post: BlogPost }>(`/admin/cms/blog/${id}`, { isPublished });
  return data.post;
}

export async function deleteBlogPost(id: string) {
  await apiClient.delete(`/admin/cms/blog/${id}`);
}

// --- Gallery ---

export interface GalleryImage {
  id: string;
  imageUrl: string;
  caption: string | null;
}

export async function listAdminGallery() {
  const { data } = await apiClient.get<{ images: GalleryImage[] }>("/cms/gallery");
  return data.images;
}

export async function addGalleryImage(input: { imageUrl: string; caption?: string }) {
  const { data } = await apiClient.post<{ image: GalleryImage }>("/admin/cms/gallery", input);
  return data.image;
}

export async function deleteGalleryImage(id: string) {
  await apiClient.delete(`/admin/cms/gallery/${id}`);
}
