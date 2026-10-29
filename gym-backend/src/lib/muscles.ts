// Library filter chips group specific muscles into a few familiar areas.
// Keep in sync with the frontends' muscle lists (gym-user-frontend/src/lib/muscles.ts).
export const MUSCLE_GROUPS = {
  chest: ['Chest', 'Upper chest', 'Lower chest', 'Pectorals'],
  back: ['Back', 'Lats', 'Upper back', 'Lower back', 'Traps', 'Rhomboids'],
  legs: ['Legs', 'Quadriceps', 'Hamstrings', 'Glutes', 'Calves', 'Adductors', 'Abductors', 'Hip flexors'],
  shoulders: ['Shoulders', 'Front delts', 'Side delts', 'Rear delts', 'Rotator cuff'],
  arms: ['Arms', 'Biceps', 'Triceps', 'Forearms'],
  core: ['Core', 'Abs', 'Obliques', 'Lower abs'],
} as const;

export type MuscleGroup = keyof typeof MUSCLE_GROUPS;
export const MUSCLE_GROUP_KEYS = Object.keys(MUSCLE_GROUPS) as [MuscleGroup, ...MuscleGroup[]];
