"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Clock, Heart, Search, Trash2 } from "lucide-react";
import { listExerciseCategories, listExercises, type Exercise } from "@/lib/api";
import { clearRecentExercises, listRecentExercises } from "@/lib/exercise-api";
import { ExerciseCard, difficultyLabel } from "@/components/exercise/exercise-card";
import { Chip, ChipSlider, MultiSelectMenu } from "@/components/exercise/library-filters";
import { useFavoriteExercises } from "@/components/exercise/favorite-button";
import { inMuscleGroup, MUSCLE_GROUPS, type MuscleGroupKey } from "@/lib/muscles";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SkeletonGrid } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];
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

// Client-side filter for the favourites / recent lists (they aren't paginated).
function matches(e: Exercise, search: string, category: string | undefined, difficulty: Difficulty[], muscleGroup?: MuscleGroupKey) {
  const term = search.toLowerCase();
  return (
    (!term || e.name.toLowerCase().includes(term) || e.targetMuscle.toLowerCase().includes(term)) &&
    (!category || e.categories.some((c) => c.slug === category)) &&
    (!difficulty.length || difficulty.includes(e.difficulty)) &&
    (!muscleGroup || inMuscleGroup(e.targetMuscle, muscleGroup))
  );
}

export default function ExercisesPage() {
  const queryClient = useQueryClient();
  const isAuthed = useAuthStore((s) => Boolean(s.accessToken));
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | undefined>();
  const [difficulty, setDifficulty] = useState<Difficulty[]>([]);
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroupKey | undefined>();
  const [page, setPage] = useState(1);
  const [confirmClear, setConfirmClear] = useState(false);
  const debouncedSearch = useDebounced(search.trim());
  const activeTab: Tab = isAuthed ? tab : "all";

  const { data: categories } = useQuery({ queryKey: ["exercise-categories"], queryFn: listExerciseCategories });

  const all = useQuery({
    queryKey: ["exercises", debouncedSearch, category, difficulty, muscleGroup, page],
    queryFn: () =>
      listExercises({ search: debouncedSearch || undefined, category, difficulty: difficulty.join(",") || undefined, muscleGroup, page, limit: PAGE_SIZE }),
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
  const filtersActive = Boolean(debouncedSearch || category || difficulty.length || muscleGroup);

  const emptyMessage =
    activeTab === "favorites" && !filtersActive
      ? "No favourites yet — tap the heart on any exercise to save it here."
      : activeTab === "recent" && !filtersActive
        ? "Exercises you open will show up here."
        : "No exercises match your filters.";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <p className="eyebrow">Library</p>
      <h1 className="mt-3 text-4xl font-bold uppercase">Exercise Library</h1>
      <p className="mt-2 text-muted">Step-by-step instructions, target muscles and common mistakes — browse freely, no account needed.</p>

      {/* Mobile: search 75% / level 25% on one row. */}
      <div className="mt-8 flex items-center gap-2">
        <div className="relative min-w-0 flex-[3] sm:flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            type="search"
            aria-label="Search exercises"
            placeholder="Search exercises..."
            className="h-10 pl-10"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
          />
        </div>
        <MultiSelectMenu
          label="Level"
          className="min-w-0 flex-1 sm:flex-none"
          options={DIFFICULTIES.map((d) => ({ value: d, label: difficultyLabel(d) }))}
          value={difficulty}
          onChange={(next) => (setDifficulty(next), resetPage())}
        />
      </div>

      {/* One slider: saved lists (signed-in only), then muscle groups, then admin categories. */}
      <div className="glass-card mt-3 flex items-center gap-3 px-3 py-2.5 sm:px-4">
        <ChipSlider label="Exercise filters">
          <Chip
            active={activeTab === "all" && !muscleGroup && !category}
            onClick={() => (setTab("all"), setMuscleGroup(undefined), setCategory(undefined), resetPage())}
          >
            All
          </Chip>
          {isAuthed && (
            <>
              <Chip active={activeTab === "favorites"} onClick={() => setTab(activeTab === "favorites" ? "all" : "favorites")}>
                <Heart className="h-3.5 w-3.5" />
                Favourites{favorites.data ? ` (${favorites.data.length})` : ""}
              </Chip>
              <Chip active={activeTab === "recent"} onClick={() => setTab(activeTab === "recent" ? "all" : "recent")}>
                <Clock className="h-3.5 w-3.5" />
                Recently viewed
              </Chip>
            </>
          )}
          {MUSCLE_GROUPS.map((g) => (
            <Chip key={g.key} active={muscleGroup === g.key} onClick={() => (setMuscleGroup(muscleGroup === g.key ? undefined : g.key), resetPage())}>
              {g.label}
            </Chip>
          ))}
          {categories?.map((c) => (
            <Chip key={c.id} active={category === c.slug} onClick={() => (setCategory(category === c.slug ? undefined : c.slug), resetPage())}>
              {c.name}
            </Chip>
          ))}
        </ChipSlider>
        {activeTab === "recent" && recent.data && recent.data.length > 0 && (
          <div className="group relative shrink-0">
            <button
              type="button"
              aria-label="Clear history"
              onClick={() => setConfirmClear(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-2 text-muted transition-colors hover:border-danger/50 hover:text-danger"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <span
              role="tooltip"
              className="pointer-events-none absolute right-0 top-full z-20 mt-2 whitespace-nowrap rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-foreground opacity-0 shadow-lg shadow-elevation transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            >
              Clear history
            </span>
          </div>
        )}
      </div>

      {activeTab === "recent" && confirmClear && (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted">Clear your viewing history?</span>
          <Button variant="destructive" size="sm" disabled={clearMutation.isPending} onClick={() => clearMutation.mutate()}>
            Yes, clear
          </Button>
          <Button variant="glass" size="sm" onClick={() => setConfirmClear(false)}>
            Cancel
          </Button>
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
