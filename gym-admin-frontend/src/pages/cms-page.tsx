import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import {
  addGalleryImage,
  createBlogPost,
  createFaq,
  createTestimonial,
  deleteBlogPost,
  deleteFaq,
  deleteGalleryImage,
  deleteTestimonial,
  getPage,
  listAdminBlogPosts,
  listAdminFaqs,
  listAdminGallery,
  listAdminTestimonials,
  togglePublishBlogPost,
  upsertPage,
  type CmsHomeContent,
} from "@/lib/cms-api";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/image-upload";

function HomeBannerSection() {
  const queryClient = useQueryClient();
  const { data: page } = useQuery({ queryKey: ["cms-page", "home"], queryFn: () => getPage("home") });
  const [content, setContent] = useState<CmsHomeContent>({});

  useEffect(() => {
    if (page) setContent(page.content ?? {});
  }, [page]);

  const mutation = useMutation({
    mutationFn: () => upsertPage("home", { title: "Home", content }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cms-page", "home"] }),
  });

  return (
    <Card>
      <CardTitle>Home banner</CardTitle>
      <div className="mt-4 flex flex-col gap-3">
        <Input
          placeholder="Headline"
          value={content.headline ?? ""}
          onChange={(e) => setContent({ ...content, headline: e.target.value })}
        />
        <Input
          placeholder="Subtext"
          value={content.subtext ?? ""}
          onChange={(e) => setContent({ ...content, subtext: e.target.value })}
        />
        <Input
          placeholder="CTA button text"
          value={content.ctaText ?? ""}
          onChange={(e) => setContent({ ...content, ctaText: e.target.value })}
        />
        <ImageUpload
          value={content.bannerImageUrl}
          onChange={(url) => setContent({ ...content, bannerImageUrl: url })}
        />
        <Button className="self-start" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? "Saving..." : "Save banner"}
        </Button>
        {mutation.isSuccess && <p className="text-xs text-accent-2">Saved.</p>}
      </div>
    </Card>
  );
}

function FaqsSection() {
  const queryClient = useQueryClient();
  const { data: faqs } = useQuery({ queryKey: ["admin-faqs"], queryFn: listAdminFaqs });
  const { register, handleSubmit, reset } = useForm<{ question: string; answer: string }>();

  const createMutation = useMutation({
    mutationFn: createFaq,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-faqs"] });
      reset();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteFaq,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-faqs"] }),
  });

  return (
    <Card>
      <CardTitle>FAQs</CardTitle>
      <form
        className="mt-4 flex flex-col gap-3"
        onSubmit={handleSubmit((values) => createMutation.mutate(values))}
      >
        <Input placeholder="Question" {...register("question", { required: true })} />
        <Input placeholder="Answer" {...register("answer", { required: true })} />
        <Button type="submit" className="self-start" disabled={createMutation.isPending}>
          <Plus className="h-4 w-4" /> Add FAQ
        </Button>
      </form>
      <div className="mt-4 flex flex-col gap-2">
        {faqs?.map((f) => (
          <div key={f.id} className="glass-input flex items-center justify-between px-4 py-2.5">
            <div>
              <div className="text-sm font-medium">{f.question}</div>
              <div className="text-xs text-muted">{f.answer}</div>
            </div>
            <button className="text-muted hover:text-danger" onClick={() => deleteMutation.mutate(f.id)}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TestimonialsSection() {
  const queryClient = useQueryClient();
  const { data: testimonials } = useQuery({ queryKey: ["admin-testimonials"], queryFn: listAdminTestimonials });
  const { register, handleSubmit, reset } = useForm<{ name: string; role: string; content: string }>();

  const createMutation = useMutation({
    mutationFn: createTestimonial,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-testimonials"] });
      reset();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteTestimonial,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-testimonials"] }),
  });

  return (
    <Card>
      <CardTitle>Testimonials</CardTitle>
      <form
        className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
        onSubmit={handleSubmit((values) => createMutation.mutate(values))}
      >
        <Input placeholder="Name" {...register("name", { required: true })} />
        <Input placeholder="Role (optional)" {...register("role")} />
        <Input placeholder="Testimonial" className="sm:col-span-2" {...register("content", { required: true })} />
        <Button type="submit" className="sm:col-span-2" disabled={createMutation.isPending}>
          <Plus className="h-4 w-4" /> Add testimonial
        </Button>
      </form>
      <div className="mt-4 flex flex-col gap-2">
        {testimonials?.map((t) => (
          <div key={t.id} className="glass-input flex items-center justify-between px-4 py-2.5">
            <div>
              <div className="text-sm font-medium">
                {t.name} {t.role && <span className="text-xs text-muted">· {t.role}</span>}
              </div>
              <div className="text-xs text-muted">{t.content}</div>
            </div>
            <button className="text-muted hover:text-danger" onClick={() => deleteMutation.mutate(t.id)}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function BlogSection() {
  const queryClient = useQueryClient();
  const { data: posts } = useQuery({ queryKey: ["admin-blog"], queryFn: listAdminBlogPosts });
  const { register, handleSubmit, reset } = useForm<{ title: string; content: string; excerpt: string }>();

  const createMutation = useMutation({
    mutationFn: createBlogPost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-blog"] });
      reset();
    },
  });
  const publishMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) => togglePublishBlogPost(id, isPublished),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-blog"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteBlogPost,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-blog"] }),
  });

  return (
    <Card>
      <CardTitle>Blog</CardTitle>
      <form
        className="mt-4 flex flex-col gap-3"
        onSubmit={handleSubmit((values) => createMutation.mutate(values))}
      >
        <Input placeholder="Title" {...register("title", { required: true })} />
        <Input placeholder="Excerpt (optional)" {...register("excerpt")} />
        <Input placeholder="Content" {...register("content", { required: true })} />
        <Button type="submit" className="self-start" disabled={createMutation.isPending}>
          <Plus className="h-4 w-4" /> Add draft
        </Button>
      </form>
      <div className="mt-4 flex flex-col gap-2">
        {posts?.map((p) => (
          <div key={p.id} className="glass-input flex items-center justify-between px-4 py-2.5">
            <div>
              <div className="text-sm font-medium">{p.title}</div>
              <div className="text-xs text-muted">{p.isPublished ? "Published" : "Draft"}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="text-muted hover:text-accent"
                onClick={() => publishMutation.mutate({ id: p.id, isPublished: !p.isPublished })}
                aria-label="Toggle publish"
              >
                {p.isPublished ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button className="text-muted hover:text-danger" onClick={() => deleteMutation.mutate(p.id)}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function GallerySection() {
  const queryClient = useQueryClient();
  const { data: images } = useQuery({ queryKey: ["admin-gallery"], queryFn: listAdminGallery });

  const addMutation = useMutation({
    mutationFn: addGalleryImage,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-gallery"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteGalleryImage,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-gallery"] }),
  });

  return (
    <Card>
      <CardTitle>Gallery</CardTitle>
      <div className="mt-4">
        <ImageUpload onChange={(url) => addMutation.mutate({ imageUrl: url })} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
        {images?.map((img) => (
          <div key={img.id} className="group relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.imageUrl} alt={img.caption ?? ""} className="aspect-square w-full rounded-xl object-cover" />
            <button
              className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
              onClick={() => deleteMutation.mutate(img.id)}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function CmsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Content Management</h1>
      <p className="mt-1 text-muted">Home banner, FAQs, testimonials, blog, and gallery.</p>

      <div className="mt-6 grid grid-cols-1 gap-6">
        <HomeBannerSection />
        <FaqsSection />
        <TestimonialsSection />
        <BlogSection />
        <GallerySection />
      </div>
    </div>
  );
}
