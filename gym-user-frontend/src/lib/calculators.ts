// Pure formulas behind the fitness tools. Everything works in kg / cm / years;
// the pages convert units before calling in.

export const LB_PER_KG = 2.20462;
export const CM_PER_IN = 2.54;

export type Sex = "MALE" | "FEMALE";

// ---------- One rep max ----------

export type OneRmFormula = "epley" | "brzycki" | "lombardi" | "average";

export const ONE_RM_FORMULAS: Record<Exclude<OneRmFormula, "average">, { label: string; calc: (w: number, r: number) => number }> = {
  epley: { label: "Epley", calc: (w, r) => w * (1 + r / 30) },
  brzycki: { label: "Brzycki", calc: (w, r) => (w * 36) / (37 - r) },
  lombardi: { label: "Lombardi", calc: (w, r) => w * r ** 0.1 },
};

export function oneRepMax(weight: number, reps: number, formula: OneRmFormula) {
  if (reps === 1) return weight;
  if (formula === "average") {
    const all = Object.values(ONE_RM_FORMULAS).map((f) => f.calc(weight, reps));
    return all.reduce((a, b) => a + b, 0) / all.length;
  }
  return ONE_RM_FORMULAS[formula].calc(weight, reps);
}

/** Typical reps you can do at each percentage of your 1RM. */
export const ONE_RM_PERCENTAGES = [
  { pct: 100, reps: "1" },
  { pct: 95, reps: "2" },
  { pct: 90, reps: "3–4" },
  { pct: 85, reps: "5–6" },
  { pct: 80, reps: "7–8" },
  { pct: 75, reps: "9–10" },
  { pct: 70, reps: "11–12" },
  { pct: 65, reps: "13–15" },
  { pct: 60, reps: "16–20" },
];

// ---------- Energy ----------

/** Mifflin-St Jeor — the most accurate general-population BMR equation. */
export function bmrMifflin(sex: Sex, weightKg: number, heightCm: number, age: number) {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "MALE" ? 5 : -161);
}

/** Harris-Benedict, revised by Roza & Shizgal (1984). */
export function bmrHarrisBenedict(sex: Sex, weightKg: number, heightCm: number, age: number) {
  return sex === "MALE"
    ? 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age
    : 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.33 * age;
}

export const ACTIVITY_LEVELS = [
  { value: "SEDENTARY", label: "Sedentary", hint: "Desk job, little exercise", factor: 1.2 },
  { value: "LIGHTLY_ACTIVE", label: "Lightly active", hint: "Exercise 1–3 days a week", factor: 1.375 },
  { value: "MODERATELY_ACTIVE", label: "Moderately active", hint: "Exercise 3–5 days a week", factor: 1.55 },
  { value: "VERY_ACTIVE", label: "Very active", hint: "Hard training 6–7 days a week", factor: 1.725 },
  { value: "EXTRA_ACTIVE", label: "Extra active", hint: "Physical job plus daily training", factor: 1.9 },
] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number]["value"];

export function tdee(bmr: number, activity: ActivityLevel) {
  return bmr * ACTIVITY_LEVELS.find((a) => a.value === activity)!.factor;
}

export const CALORIE_GOALS = [
  { key: "loss", label: "Fat loss", factor: 0.8, note: "About 0.5–1 kg a week" },
  { key: "mild-loss", label: "Mild cut", factor: 0.9, note: "Slow, muscle-friendly loss" },
  { key: "maintain", label: "Maintain", factor: 1, note: "Hold your current weight" },
  { key: "lean-bulk", label: "Lean bulk", factor: 1.1, note: "Gain muscle, minimise fat" },
] as const;

/** Below these, a diet should be supervised. */
export const MIN_SAFE_CALORIES: Record<Sex, number> = { MALE: 1500, FEMALE: 1200 };

// ---------- Macros ----------

export const MACRO_PRESETS = [
  { key: "balanced", label: "Balanced", protein: 30, carbs: 40, fat: 30 },
  { key: "high-protein", label: "High protein", protein: 40, carbs: 35, fat: 25 },
  { key: "low-carb", label: "Low carb", protein: 40, carbs: 20, fat: 40 },
  { key: "keto", label: "Keto", protein: 25, carbs: 5, fat: 70 },
] as const;

export function macroGrams(calories: number, split: { protein: number; carbs: number; fat: number }) {
  return {
    protein: (calories * split.protein) / 100 / 4,
    carbs: (calories * split.carbs) / 100 / 4,
    fat: (calories * split.fat) / 100 / 9,
  };
}

// ---------- BMI ----------

export const BMI_BANDS = [
  { label: "Underweight", max: 18.5 },
  { label: "Normal", max: 25 },
  { label: "Overweight", max: 30 },
  { label: "Obese", max: Infinity },
] as const;

export function bmi(weightKg: number, heightCm: number) {
  const m = heightCm / 100;
  const value = weightKg / (m * m);
  return {
    value,
    category: BMI_BANDS.find((b) => value < b.max)!.label,
    healthyMinKg: 18.5 * m * m,
    healthyMaxKg: 24.9 * m * m,
  };
}

// ---------- Water ----------

/** 35 ml per kg, plus ~0.5 L per hour of training, plus 0.5 L in hot weather. */
export function waterLiters(weightKg: number, workoutMinutes: number, hot: boolean) {
  const base = weightKg * 0.035;
  const training = (workoutMinutes / 60) * 0.5;
  return { base, training, heat: hot ? 0.5 : 0, total: base + training + (hot ? 0.5 : 0) };
}

// ---------- Heart rate ----------

export const HR_ZONES = [
  { zone: 1, name: "Recovery", from: 50, to: 60, use: "Warm-ups, cool-downs, easy days" },
  { zone: 2, name: "Fat burn", from: 60, to: 70, use: "Long steady cardio, builds your base" },
  { zone: 3, name: "Aerobic", from: 70, to: 80, use: "Improves heart and lung fitness" },
  { zone: 4, name: "Threshold", from: 80, to: 90, use: "Tempo work, raises your lactate threshold" },
  { zone: 5, name: "Peak", from: 90, to: 100, use: "Short all-out intervals only" },
] as const;

/** Tanaka (208 − 0.7 × age) fits adults better than 220 − age. */
export function maxHeartRate(age: number) {
  return 208 - 0.7 * age;
}

/** With a resting rate, zones use the Karvonen (heart-rate reserve) method. */
export function zoneBpm(maxHr: number, pct: number, restingHr?: number) {
  return restingHr ? (maxHr - restingHr) * (pct / 100) + restingHr : maxHr * (pct / 100);
}

// ---------- Plates ----------

export const PLATE_SETS = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lb: [45, 35, 25, 10, 5, 2.5],
} as const;

/** Greedy per-side loading with the plates available. Remainder is what couldn't be matched. */
export function loadPlates(target: number, bar: number, plates: number[]) {
  const perSide = (target - bar) / 2;
  const sorted = [...plates].sort((a, b) => b - a);
  const side: number[] = [];
  let left = Math.round(perSide * 1000) / 1000;
  for (const p of sorted) {
    while (left + 1e-9 >= p) {
      side.push(p);
      left = Math.round((left - p) * 1000) / 1000;
    }
  }
  const loaded = bar + side.reduce((a, b) => a + b, 0) * 2;
  return { perSide, side, loaded, remainder: Math.max(0, target - loaded) };
}
