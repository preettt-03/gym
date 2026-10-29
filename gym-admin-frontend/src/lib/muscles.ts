// Mirrors gym-backend/src/lib/muscles.ts — the library's muscle-group chips match
// on the primary muscle, so picking from this list keeps exercises filterable.
export const MUSCLE_GROUPS = {
  Chest: ["Chest", "Upper chest", "Lower chest", "Pectorals"],
  Back: ["Back", "Lats", "Upper back", "Lower back", "Traps", "Rhomboids"],
  Legs: ["Legs", "Quadriceps", "Hamstrings", "Glutes", "Calves", "Adductors", "Abductors", "Hip flexors"],
  Shoulders: ["Shoulders", "Front delts", "Side delts", "Rear delts", "Rotator cuff"],
  Arms: ["Arms", "Biceps", "Triceps", "Forearms"],
  Core: ["Core", "Abs", "Obliques", "Lower abs"],
} as const;

export const MUSCLES: string[] = Object.values(MUSCLE_GROUPS).flat();

export const EQUIPMENT_SUGGESTIONS = [
  "Bodyweight",
  "Barbell",
  "Dumbbells",
  "Kettlebell",
  "Cable machine",
  "Leg press machine",
  "Smith machine",
  "Pull-up bar",
  "Bench",
  "Resistance band",
  "Medicine ball",
];
