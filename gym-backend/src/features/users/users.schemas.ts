import { z } from 'zod';
import { normalizePhone } from '@/lib/phone';

const genderEnum = z.enum(['MALE', 'FEMALE', 'OTHER']);
const fitnessGoalEnum = z.enum(['WEIGHT_LOSS', 'MUSCLE_GAIN', 'MAINTENANCE', 'ENDURANCE', 'GENERAL_FITNESS']);
const experienceLevelEnum = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']);
const activityLevelEnum = z.enum([
  'SEDENTARY',
  'LIGHTLY_ACTIVE',
  'MODERATELY_ACTIVE',
  'VERY_ACTIVE',
  'EXTRA_ACTIVE',
]);

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

const healthList = z
  .array(z.string().trim().max(80, 'Keep each item under 80 characters'))
  .max(20, 'At most 20 items')
  .transform((list) => [...new Set(list.filter(Boolean))]);
const optionalText = (max: number) =>
  z.string().trim().max(max).transform((v) => v || null).nullable().optional();

/** Whole years from a YYYY-MM-DD date to today. */
export function yearsSince(date: string, now = new Date()) {
  const [y, m, d] = date.split('-').map(Number);
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age -= 1;
  return age;
}

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    age: z.number().int().min(1).max(120).optional(),
    gender: genderEnum.optional(),
    heightCm: z.number().min(100, 'Height must be at least 100 cm').max(250, 'Height must be at most 250 cm').optional(),
    weightKg: z.number().min(25, 'Weight must be at least 25 kg').max(300, 'Weight must be at most 300 kg').optional(),
    targetWeightKg: z.number().min(25, 'Target must be at least 25 kg').max(300, 'Target must be at most 300 kg').optional(),
    fitnessGoal: fitnessGoalEnum.optional(),
    experienceLevel: experienceLevelEnum.optional(),
    activityLevel: activityLevelEnum.optional(),
    gymName: z.string().optional(),
    gymBranch: z.string().optional(),
    medicalConditions: healthList.optional(),
    allergies: healthList.optional(),
    injuries: healthList.optional(),
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
      .refine((d) => {
        const age = yearsSince(d);
        return age >= 10 && age <= 100;
      }, 'Date of birth should make you between 10 and 100 years old')
      .nullable()
      .optional(),
    bloodGroup: z.enum(BLOOD_GROUPS).nullable().optional(),
    alternatePhone: z
      .string()
      .trim()
      .transform((v, ctx) => {
        if (!v) return null;
        const phone = normalizePhone(v);
        if (!phone) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid mobile number' });
        return phone;
      })
      .nullable()
      .optional(),
    addressLine1: optionalText(120),
    addressLine2: optionalText(120),
    city: optionalText(60),
    state: optionalText(60),
    postalCode: z
      .string()
      .trim()
      .regex(/^$|^[A-Za-z0-9 -]{3,10}$/, 'Enter a valid PIN / postal code')
      .transform((v) => v || null)
      .nullable()
      .optional(),
    country: optionalText(60),
  }),
});

const contactBody = { phone: z.string().trim().min(6, 'Enter the mobile number').max(20) };
export const sendPhoneOtpSchema = z.object({ body: z.object(contactBody) });
export const verifyPhoneSchema = z.object({ body: z.object({ ...contactBody, code: z.string().trim().length(6, 'Enter the 6-digit code') }) });
export const sendEmailOtpSchema = z.object({ body: z.object({ email: z.string().trim().email('Enter a valid email') }) });
export const verifyEmailChangeSchema = z.object({ body: z.object({ email: z.string().trim().email(), code: z.string().trim().length(6, 'Enter the 6-digit code') }) });

export const logWeightSchema = z.object({
  body: z.object({
    weightKg: z.number().min(25, 'Weight must be at least 25 kg').max(300, 'Weight must be at most 300 kg'),
    loggedAt: z.string().datetime().optional(),
  }),
});
