// Mirrors gym-backend/src/lib/muscles.ts: the library's muscle-group chips filter
// on an exercise's primary muscle. Used client-side for favourites/recent too.
export const MUSCLE_GROUPS = [
  { key: "chest", label: "Chest", muscles: ["Chest", "Upper chest", "Lower chest", "Pectorals"] },
  { key: "back", label: "Back", muscles: ["Back", "Lats", "Upper back", "Lower back", "Traps", "Rhomboids"] },
  { key: "legs", label: "Legs", muscles: ["Legs", "Quadriceps", "Hamstrings", "Glutes", "Calves", "Adductors", "Abductors", "Hip flexors"] },
  { key: "shoulders", label: "Shoulders", muscles: ["Shoulders", "Front delts", "Side delts", "Rear delts", "Rotator cuff"] },
  { key: "arms", label: "Arms", muscles: ["Arms", "Biceps", "Triceps", "Forearms"] },
  { key: "core", label: "Core", muscles: ["Core", "Abs", "Obliques", "Lower abs"] },
] as const;

export type MuscleGroupKey = (typeof MUSCLE_GROUPS)[number]["key"];

export function inMuscleGroup(muscle: string, group: MuscleGroupKey) {
  const target = muscle.toLowerCase();
  return MUSCLE_GROUPS.find((g) => g.key === group)!.muscles.some((m) => m.toLowerCase() === target);
}

/** The library group an exercise's primary muscle belongs to, if any. */
export function muscleGroupOf(muscle: string): MuscleGroupKey | null {
  const target = muscle.toLowerCase();
  return MUSCLE_GROUPS.find((g) => g.muscles.some((m) => m.toLowerCase() === target))?.key ?? null;
}
