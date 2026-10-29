"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import type { Exercise } from "@/lib/api";
import { listFavoriteExercises, setExerciseFavorite } from "@/lib/exercise-api";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

export const FAVORITES_KEY = ["exercise-favorites"] as const;

// Shared favourites list; every heart on the page reads from the same query.
export function useFavoriteExercises() {
  const isAuthed = useAuthStore((s) => Boolean(s.accessToken));
  return useQuery({ queryKey: FAVORITES_KEY, queryFn: listFavoriteExercises, enabled: isAuthed });
}

// Heart toggle with an optimistic update that rolls back if the request fails.
export function FavoriteButton({ exercise, size = "sm" }: { exercise: Exercise; size?: "sm" | "lg" }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAuthed = useAuthStore((s) => Boolean(s.accessToken));
  const { data: favorites } = useFavoriteExercises();
  const favorited = Boolean(favorites?.some((f) => f.id === exercise.id));

  const mutation = useMutation({
    mutationFn: (next: boolean) => setExerciseFavorite(exercise.id, next),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: FAVORITES_KEY });
      const previous = queryClient.getQueryData<Exercise[]>(FAVORITES_KEY);
      queryClient.setQueryData<Exercise[]>(FAVORITES_KEY, (list = []) =>
        next ? [exercise, ...list.filter((f) => f.id !== exercise.id)] : list.filter((f) => f.id !== exercise.id)
      );
      return { previous };
    },
    onError: (_err, _next, ctx) => queryClient.setQueryData(FAVORITES_KEY, ctx?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: FAVORITES_KEY }),
  });

  const label = favorited ? `Remove ${exercise.name} from favourites` : `Add ${exercise.name} to favourites`;

  return (
    <button
      type="button"
      aria-label={isAuthed ? label : `Log in to save ${exercise.name}`}
      aria-pressed={isAuthed ? favorited : undefined}
      title={isAuthed ? undefined : "Log in to save favourites"}
      onClick={() => {
        if (!isAuthed) {
          router.push("/login");
          return;
        }
        mutation.mutate(!favorited);
      }}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border transition-colors",
        size === "sm" ? "h-9 w-9" : "h-11 gap-2 px-4 text-sm font-semibold",
        favorited ? "border-gold/50 bg-gold/15 text-gold" : "border-border bg-surface-2 text-muted hover:text-gold"
      )}
    >
      <Heart className={cn("h-4 w-4", favorited && "fill-gold")} />
      {size === "lg" && (favorited ? "Saved" : "Save")}
    </button>
  );
}
