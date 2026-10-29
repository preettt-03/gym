import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dumbbell, Film, Images, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { deleteExercise, listExercises, type AdminExercise, type Difficulty } from "@/lib/api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiErrorMessage, useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, PageHeader, Pagination } from "@/components/ui/page";
import { Skeleton } from "@/components/ui/skeleton";
import { ExerciseFormDialog } from "@/components/exercise/exercise-form-dialog";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 24;

const DIFFICULTY_STYLE: Record<Difficulty, string> = {
  BEGINNER: "border-success/30 text-success",
  INTERMEDIATE: "border-gold/40 text-gold",
  ADVANCED: "border-danger/40 text-danger",
};

function ExerciseCard({ exercise, onEdit, onDelete }: { exercise: AdminExercise; onEdit: () => void; onDelete: () => void }) {
  const cover = exercise.thumbnailUrl ?? exercise.images[0];
  const missing = [!cover && "image", exercise.instructions.length === 0 && "steps"].filter(Boolean);

  return (
    <article className="glass-card flex flex-col overflow-hidden">
      <div className="relative aspect-video bg-surface-2">
        {cover ? (
          <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center bg-linear-to-br from-surface-2 to-background">
            <Dumbbell className="h-8 w-8 text-gold/40" />
          </div>
        )}
        <div className="absolute bottom-2 left-2 flex gap-1.5">
          {exercise.videoUrl && (
            <span className="flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] text-white">
              <Film className="h-3 w-3" /> Video
            </span>
          )}
          {exercise.images.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] text-white">
              <Images className="h-3 w-3" /> {exercise.images.length}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-semibold leading-tight">{exercise.name}</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[11px] text-gold">{exercise.targetMuscle}</span>
            {exercise.secondaryMuscles.slice(0, 3).map((m) => (
              <span key={m} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
                {m}
              </span>
            ))}
            {exercise.secondaryMuscles.length > 3 && <span className="px-1 text-[11px] text-muted">+{exercise.secondaryMuscles.length - 3}</span>}
          </div>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", DIFFICULTY_STYLE[exercise.difficulty])}>
            {exercise.difficulty.charAt(0) + exercise.difficulty.slice(1).toLowerCase()}
          </span>
          {missing.length > 0 && <span className="text-[11px] text-muted">No {missing.join(" or ")} yet</span>}
        </div>
        <div className="flex gap-2 border-t border-border pt-3">
          <Button variant="glass" size="sm" className="flex-1" onClick={onEdit} aria-label={`Edit ${exercise.name}`}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
          <Button variant="glass" size="sm" className="text-muted hover:text-danger" onClick={onDelete} aria-label={`Delete ${exercise.name}`}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </article>
  );
}

export function ExercisesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  // undefined = closed, null = adding, exercise = editing.
  const [editing, setEditing] = useState<AdminExercise | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<AdminExercise | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  const { data, isPending, isError, isPlaceholderData } = useQuery({
    queryKey: ["admin-exercises", debouncedSearch, page],
    queryFn: () => listExercises({ search: debouncedSearch || undefined, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: (ex: AdminExercise) => deleteExercise(ex.id),
    onSuccess: (_d, ex) => {
      queryClient.invalidateQueries({ queryKey: ["admin-exercises"] });
      toast.show(`Deleted ${ex.name}`);
      setDeleting(null);
    },
    onError: (err) => toast.show(apiErrorMessage(err, "Could not delete the exercise"), "error"),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Catalog"
        title="Exercises"
        description={`${data?.pagination.total ?? 0} exercises in the library. Media, steps and tips appear on the member library and detail pages.`}
        actions={
          <Button onClick={() => setEditing(null)}>
            <Plus className="h-4 w-4" /> Add exercise
          </Button>
        }
      />

      <div className="relative mt-6 max-w-md">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          type="search"
          aria-label="Search exercises"
          placeholder="Search by name or muscle..."
          className="pl-11"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {isPending && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-80 rounded-2xl" />
          ))}
        </div>
      )}
      {isError && (
        <p role="alert" className="mt-6 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          Could not load exercises. Check that the backend is running, then refresh.
        </p>
      )}
      {data && data.items.length === 0 && (
        <div className="mt-6">
          <EmptyState
            title={debouncedSearch ? "No exercises match your search" : "No exercises yet"}
            description={debouncedSearch ? "Try a different name or muscle." : "Add the first one to start the member library."}
            action={
              !debouncedSearch && (
                <Button onClick={() => setEditing(null)}>
                  <Plus className="h-4 w-4" /> Add exercise
                </Button>
              )
            }
          />
        </div>
      )}
      {data && data.items.length > 0 && (
        <div className={cn("transition-opacity", isPlaceholderData && "opacity-60")}>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((ex) => (
              <ExerciseCard key={ex.id} exercise={ex} onEdit={() => setEditing(ex)} onDelete={() => setDeleting(ex)} />
            ))}
          </div>
          <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} total={data.pagination.total} onPageChange={setPage} />
        </div>
      )}

      <ExerciseFormDialog open={editing !== undefined} exercise={editing ?? null} onClose={() => setEditing(undefined)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete exercise?"
        message={
          <>
            <strong>{deleting?.name}</strong> will disappear from the member library. Plans that already use it keep their history.
          </>
        }
        confirmLabel="Delete"
        destructive
        pending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
