import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dumbbell, Loader2, Pencil, Plus, Search, Trash2, UtensilsCrossed } from "lucide-react";
import {
  categoryUsage,
  createCategory,
  deleteCategory,
  listManagedCategories,
  updateCategory,
  type CategoryKind,
  type ManagedCategory,
} from "@/lib/api";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FieldError, FormAlert } from "@/components/ui/form-message";
import { apiErrorMessage, useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const KINDS: Record<CategoryKind, { label: string; usedBy: string; icon: typeof Dumbbell; hint: string }> = {
  exercise: { label: "Exercise", usedBy: "exercise", icon: Dumbbell, hint: "Group exercises in the library, e.g. Strength, Cardio, Mobility." },
  diet: { label: "Diet", usedBy: "diet plan", icon: UtensilsCrossed, hint: "Tag diet plans, e.g. Vegetarian, High protein, Keto." },
};

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60, "Name is too long"),
  description: z.string().trim().max(300, "Description is too long"),
});
type FormValues = z.infer<typeof schema>;

function CategoryFormDialog({
  open,
  kind,
  category,
  onClose,
}: {
  open: boolean;
  kind: CategoryKind;
  category: ManagedCategory | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), mode: "onTouched" });

  useEffect(() => {
    if (open) {
      reset({ name: category?.name ?? "", description: category?.description ?? "" });
      setServerError(null);
    }
  }, [open, category, reset]);

  const mutation = useMutation({
    mutationFn: ({ name, description }: FormValues) =>
      category
        ? updateCategory(kind, category.id, { name, description: description || null })
        : createCategory(kind, { name, description: description || undefined }),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["managed-categories", kind] });
      toast.show(category ? `Updated ${saved.name}` : `Added ${saved.name}`);
      onClose();
    },
    onError: (err) => setServerError(apiErrorMessage(err, "Could not save category")),
  });

  return (
    <Dialog
      open={open}
      onClose={mutation.isPending ? () => {} : onClose}
      size="sm"
      title={`${category ? "Edit" : "Add"} ${KINDS[kind].label.toLowerCase()} category`}
      footer={
        <>
          <Button variant="glass" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="category-form" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {category ? "Save changes" : "Add category"}
          </Button>
        </>
      }
    >
      <form
        id="category-form"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((values) => {
          setServerError(null);
          mutation.mutate(values);
        })}
      >
        <div>
          <label htmlFor="category-name" className="mb-1.5 block text-sm font-medium">
            Name
          </label>
          <Input
            id="category-name"
            data-autofocus
            aria-invalid={errors.name ? true : undefined}
            aria-describedby="category-name-error"
            {...register("name")}
          />
          <FieldError id="category-name-error" message={errors.name?.message} />
        </div>
        <div>
          <label htmlFor="category-description" className="mb-1.5 block text-sm font-medium">
            Description <span className="text-xs font-normal text-muted">(optional)</span>
          </label>
          <textarea
            id="category-description"
            rows={3}
            className="glass-input w-full resize-none px-4 py-3 text-sm outline-none placeholder:text-muted focus:border-gold/60 focus:ring-2 focus:ring-gold/25 aria-invalid:border-danger/70"
            aria-invalid={errors.description ? true : undefined}
            aria-describedby="category-description-error"
            {...register("description")}
          />
          <FieldError id="category-description-error" message={errors.description?.message} />
        </div>
        <FormAlert message={serverError} />
      </form>
    </Dialog>
  );
}

export function CategoriesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<CategoryKind>("exercise");
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<ManagedCategory | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<ManagedCategory | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ["managed-categories", kind],
    queryFn: () => listManagedCategories(kind),
  });

  const deleteMutation = useMutation({
    mutationFn: (c: ManagedCategory) => deleteCategory(kind, c.id),
    onSuccess: (_d, c) => {
      queryClient.invalidateQueries({ queryKey: ["managed-categories", kind] });
      toast.show(`Deleted ${c.name}`);
      setDeleting(null);
    },
    onError: (err) => {
      toast.show(apiErrorMessage(err, "Could not delete category"), "error");
      setDeleting(null);
    },
  });

  const openForm = (c: ManagedCategory | null) => {
    setEditing(c);
    setFormOpen(true);
  };

  const term = filter.trim().toLowerCase();
  const visible = data?.filter((c) => !term || c.name.toLowerCase().includes(term) || c.description?.toLowerCase().includes(term));
  const meta = KINDS[kind];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Catalog"
        title="Categories"
        description="Organise the exercise library and diet plans. A category can only be deleted once nothing uses it."
        actions={
          <Button onClick={() => openForm(null)}>
            <Plus className="h-4 w-4" /> Add {meta.label.toLowerCase()} category
          </Button>
        }
      />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Category type" className="inline-flex rounded-xl border border-border bg-surface p-1">
          {(Object.keys(KINDS) as CategoryKind[]).map((k) => {
            const Icon = KINDS[k].icon;
            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={kind === k}
                onClick={() => {
                  setKind(k);
                  setFilter("");
                }}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
                  kind === k ? "bg-gold text-accent-foreground" : "text-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" /> {KINDS[k].label}
              </button>
            );
          })}
        </div>
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            type="search"
            aria-label="Filter categories"
            placeholder="Filter categories..."
            className="pl-11"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">{meta.hint}</p>

      {isError && (
        <p role="alert" className="mt-6 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          Could not load categories. Check that the backend is running, then refresh.
        </p>
      )}

      {isPending && (
        <div className="mt-6 flex flex-col gap-2" aria-label="Loading categories">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      )}

      {visible && visible.length === 0 && (
        <div className="mt-6">
          {term ? (
            <EmptyState title={`No categories match “${filter.trim()}”`} />
          ) : (
            <EmptyState
              title={`No ${meta.label.toLowerCase()} categories yet`}
              action={
                <Button onClick={() => openForm(null)}>
                  <Plus className="h-4 w-4" /> Add the first one
                </Button>
              }
            />
          )}
        </div>
      )}

      {visible && visible.length > 0 && (
        <ul className="mt-6 flex flex-col gap-2">
          {visible.map((c) => {
            const used = categoryUsage(c);
            return (
              <li key={c.id} className="glass-card flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="font-medium">{c.name}</p>
                  {c.description && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{c.description}</p>}
                  <p className="mt-1 text-xs text-muted">
                    {used ? `Used by ${used} ${meta.usedBy}${used === 1 ? "" : "s"}` : "Not used yet"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="sm" className="h-9 w-9 p-0" aria-label={`Edit ${c.name}`} onClick={() => openForm(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 text-danger hover:bg-danger/10"
                    aria-label={used ? `${c.name} is in use and can't be deleted` : `Delete ${c.name}`}
                    title={used ? `Remove it from ${used} ${meta.usedBy}${used === 1 ? "" : "s"} before deleting` : undefined}
                    disabled={used > 0}
                    onClick={() => setDeleting(c)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <CategoryFormDialog open={formOpen} kind={kind} category={editing} onClose={() => setFormOpen(false)} />

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.name ?? "category"}?`}
        message="Nothing uses this category, so deleting it won't affect any exercises or diet plans. Adding a category with the same name later restores it."
        confirmLabel="Delete category"
        destructive
        pending={deleteMutation.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
      />
    </div>
  );
}
