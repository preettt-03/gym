import { ActivityLevel, Gender } from '@prisma/client';

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  SEDENTARY: 1.2,
  LIGHTLY_ACTIVE: 1.375,
  MODERATELY_ACTIVE: 1.55,
  VERY_ACTIVE: 1.725,
  EXTRA_ACTIVE: 1.9,
};

export function calculateBmi(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(1));
}

export function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

// Mifflin-St Jeor equation
export function calculateBmr(weightKg: number, heightCm: number, age: number, gender: Gender | null): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (gender === 'MALE') return Math.round(base + 5);
  if (gender === 'FEMALE') return Math.round(base - 161);
  return Math.round(base - 78); // neutral midpoint when gender is unset/OTHER
}

export function calculateCalorieNeeds(bmr: number, activityLevel: ActivityLevel | null): number {
  const multiplier = activityLevel ? ACTIVITY_MULTIPLIERS[activityLevel] : ACTIVITY_MULTIPLIERS.SEDENTARY;
  return Math.round(bmr * multiplier);
}

export function calculateWaterIntakeLiters(weightKg: number): number {
  return Number((weightKg * 0.033).toFixed(2));
}

// US Navy method; measurements in cm
export function calculateBodyFatPercent(
  gender: Gender,
  heightCm: number,
  neckCm: number,
  waistCm: number,
  hipCm?: number
): number {
  const log10 = Math.log10;
  if (gender === 'FEMALE') {
    if (!hipCm) throw new Error('hipCm is required for the female body-fat formula');
    const value = 495 / (1.29579 - 0.35004 * log10(waistCm + hipCm - neckCm) + 0.221 * log10(heightCm)) - 450;
    return Number(value.toFixed(1));
  }
  const value = 495 / (1.0324 - 0.19077 * log10(waistCm - neckCm) + 0.15456 * log10(heightCm)) - 450;
  return Number(value.toFixed(1));
}
