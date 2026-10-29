"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Clock, Heart, LayoutGrid, Search, Trash2 } from "lucide-react";
import { listExerciseCategories, listExercises, type Exercise } from "@/lib/api";
import { clearRecentExercises, listRecentExercises } from "@/lib/exercise-api";
import { ExerciseCard, difficultyLabel } from "@/components/exercise/exercise-card";
import { useFavoriteExercises } from "@/components/exercise/favorite-button";
import { inMuscleGroup, MUSCLE_GROUPS, type MuscleGroupKey } from "@/lib/muscles";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SkeletonGrid } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
const PAGE_SIZE = 12;
type Tab = "all" | "favorites" | "recent";

const timeAgo = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function viewedLabel(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 60) return timeAgo.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return timeAgo.format(-hours, "hour");
  return timeAgo.format(-Math.round(hours / 24), "day");
}

function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
        active ? "border-gold bg-gold text-accent-foreground" : "border-border text-muted hover:border-gold/40 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

// Labelled row of chips; scrolls sideways on phones instead of wrapping into a wall.
function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <span className="w-32 shrink-0 whitespace-nowrap text-xs font-semibold uppercase tracking-[0.18em] text-muted">{label}</span>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&>*]:shrink-0">{children}</div>
    </div>
  );
}

// Client-side filter for the favourites / recent lists (they aren't paginated).
function matches(e: Exercise, search: string, category?: string, difficulty?: string, muscleGroup?: MuscleGroupKey) {
  const term = search.toLowerCase();
  return (
    (!term || e.name.toLowerCase().includes(term) || e.targetMuscle.toLowerCase().includes(term)) &&
    (!category || e.categories.some((c) => c.slug === category)) &&
    (!difficulty || e.difficulty === difficulty) &&
    (!muscleGroup || inMuscleGroup(e.targetMuscle, muscleGroup))
  );
}

export default function ExercisesPage() {
  const queryClient = useQueryClient();
  const isAuthed = useAuthStore((s) => Boolean(s.accessToken));
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | undefined>();
  const [difficulty, setDifficulty] = useState<string | undefined>();
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroupKey | undefined>();
  const [page, setPage] = useState(1);
  const [confirmClear, setConfirmClear] = useState(false);
  const debouncedSearch = useDebounced(search.trim());
  const activeTab: Tab = isAuthed ? tab : "all";

  const { data: categories } = useQuery({ queryKey: ["exercise-categories"], queryFn: listExerciseCategories });

  const all = useQuery({
    queryKey: ["exercises", debouncedSearch, category, difficulty, muscleGroup, page],
    queryFn: () => listExercises({ search: debouncedSearch || undefined, category, difficulty, muscleGroup, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    enabled: activeTab === "all",
  });
  const favorites = useFavoriteExercises();
  const recent = useQuery({ queryKey: ["exercise-recent"], queryFn: listRecentExercises, enabled: isAuthed && activeTab === "recent" });

  const clearMutation = useMutation({
    mutationFn: clearRecentExercises,
    onSuccess: () => {
      queryClient.setQueryData(["exercise-recent"], []);
      setConfirmClear(false);
    },
  });

  const resetPage = () => setPage(1);
  const current = activeTab === "all" ? all : activeTab === "favorites" ? favorites : recent;
  const items =
    activeTab === "all"
      ? all.data?.items
      : (activeTab === "favorites" ? favorites.data : recent.data)?.filter((e) => matches(e, debouncedSearch, category, difficulty, muscleGroup));
  const filtersActive = Boolean(debouncedSearch || category || difficulty || muscleGroup);

  const emptyMessage =
    activeTab === "favorites" && !filtersActive
      ? "No favourites yet — tap the heart on any exercise to save it here."
      : activeTab === "recent" && !filtersActive
        ? "Exercises you open will show up here."
        : "No exercises match your filters.";

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Library</p>
      <h1 className="mt-3 text-4xl font-bold uppercase">Exercise Library</h1>
      <p className="mt-2 text-muted">Step-by-step instructions, target muscles and common mistakes — browse freely, no account needed.</p>

      {isAuthed && (
        <div role="tablist" aria-label="Exercise lists" className="mt-8 flex max-w-full overflow-x-auto rounded-xl border border-border bg-surface p-1 sm:inline-flex">
          {(
            [
              ["all", "All", LayoutGrid],
              ["favorites", `Favourites${favorites.data ? ` (${favorites.data.length})` : ""}`, Heart],
              ["recent", "Recently viewed", Clock],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activeTab === key}
              onClick={() => setTab(key)}
              className={cn(
                "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors sm:px-4",
                activeTab === key ? "bg-gold text-accent-foreground" : "text-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="glass-card mt-6 flex flex-col gap-4 p-4 sm:p-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            type="search"
            aria-label="Search exercises"
            placeholder="Search by name or target muscle..."
            className="pl-11"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
          />
        </div>
        {items && (
          <p className="-mb-1 text-right text-[11px] font-bold uppercase tracking-[0.18em] text-gold" aria-live="polite">
            {activeTab === "all" ? all.data?.pagination.total ?? items.length : items.length} exercise
            {(activeTab === "all" ? all.data?.pagination.total ?? items.length : items.length) === 1 ? "" : "s"}
          </p>
        )}
        <ChipRow label="Muscle group">
          <Chip active={!muscleGroup} onClick={() => (setMuscleGroup(undefined), resetPage())}>
            All
          </Chip>
          {MUSCLE_GROUPS.map((g) => (
            <Chip key={g.key} active={muscleGroup === g.key} onClick={() => (setMuscleGroup(g.key), resetPage())}>
              {g.label}
            </Chip>
          ))}
        </ChipRow>
        <ChipRow label="Difficulty">
          <Chip active={!difficulty} onClick={() => (setDifficulty(undefined), resetPage())}>
            Any
          </Chip>
          {DIFFICULTIES.map((d) => (
            <Chip key={d} active={difficulty === d} onClick={() => (setDifficulty(d), resetPage())}>
              {difficultyLabel(d)}
            </Chip>
          ))}
        </ChipRow>
        {categories && categories.length > 0 && (
          <ChipRow label="Category">
            <Chip active={!category} onClick={() => (setCategory(undefined), resetPage())}>
              All
            </Chip>
            {categories.map((c) => (
              <Chip key={c.id} active={category === c.slug} onClick={() => (setCategory(c.slug), resetPage())}>
                {c.name}
              </Chip>
            ))}
          </ChipRow>
        )}
      </div>

      {activeTab === "recent" && recent.data && recent.data.length > 0 && (
        <div className="mt-6 flex items-center gap-3 text-sm">
          {confirmClear ? (
            <>
              <span className="text-muted">Clear your viewing history?</span>
              <Button variant="destructive" size="sm" disabled={clearMutation.isPending} onClick={() => clearMutation.mutate()}>
                Yes, clear
              </Button>
              <Button variant="glass" size="sm" onClick={() => setConfirmClear(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="glass" size="sm" onClick={() => setConfirmClear(true)}>
              <Trash2 className="h-4 w-4" /> Clear history
            </Button>
          )}
        </div>
      )}

      {current.isPending && current.fetchStatus !== "idle" && (
        <SkeletonGrid count={6} className="mt-8 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" itemClassName="h-80" />
      )}
      {current.isError && (
        <p role="alert" className="mt-8 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          Could not load exercises. Please try again in a moment.
        </p>
      )}
      {items && items.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
          <p className="text-muted">{emptyMessage}</p>
          {activeTab !== "all" && !filtersActive && (
            <button type="button" onClick={() => setTab("all")} className="mt-3 text-sm font-semibold text-gold hover:underline">
              Browse all exercises
            </button>
          )}
        </div>
      )}

      {items && items.length > 0 && (
        <div className={cn("mt-8 transition-opacity", activeTab === "all" && all.isPlaceholderData && "opacity-60")}>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((exercise) => (
              <li key={exercise.id}>
                <ExerciseCard
                  exercise={exercise}
                  meta={"viewedAt" in exercise ? `Viewed ${viewedLabel(exercise.viewedAt as string)}` : undefined}
                />
              </li>
            ))}
          </ul>

          {activeTab === "all" && all.data && all.data.pagination.totalPages > 1 && (
            <nav aria-label="Pagination" className="mt-8 flex items-center justify-between gap-3 text-sm">
              <span className="text-muted">
                Page {all.data.pagination.page} of {all.data.pagination.totalPages} · {all.data.pagination.total} exercises
              </span>
              <div className="flex gap-2">
                <Button variant="glass" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <Button variant="glass" size="sm" disabled={page >= all.data.pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </nav>
          )}
        </div>
      )}

      {!isAuthed && (
        <p className="mt-10 text-center text-sm text-muted">
          <Link href="/login" className="font-semibold text-gold hover:underline">
            Log in
          </Link>{" "}
          to save favourites and see what you viewed recently.
        </p>
      )}
    </div>
  );
}
