import { apiClient } from "@/lib/api-client";

export interface UserProfile {
  id: string;
  email: string | null;
  isEmailVerified: boolean;
  phone: string | null;
  isPhoneVerified: boolean;
  hasGoogle: boolean;
  alternatePhone: string | null;
  dateOfBirth: string | null;
  bloodGroup: string | null;
  medicalConditions: string[];
  allergies: string[];
  injuries: string[];
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  name: string | null;
  photoUrl: string | null;
  age: number | null;
  gender: "MALE" | "FEMALE" | "OTHER" | null;
  heightCm: number | null;
  weightKg: number | null;
  targetWeightKg: number | null;
  fitnessGoal: string | null;
  experienceLevel: string | null;
  activityLevel: string | null;
  gymName: string | null;
  coins: number;
  xp: number;
}

export async function getMyProfile() {
  const { data } = await apiClient.get<{ user: UserProfile }>("/users/me");
  return data.user;
}

export interface UpdateProfileInput {
  name?: string;
  age?: number;
  gender?: "MALE" | "FEMALE" | "OTHER";
  heightCm?: number;
  weightKg?: number;
  targetWeightKg?: number;
  fitnessGoal?: "WEIGHT_LOSS" | "MUSCLE_GAIN" | "MAINTENANCE" | "ENDURANCE" | "GENERAL_FITNESS";
  experienceLevel?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  activityLevel?: "SEDENTARY" | "LIGHTLY_ACTIVE" | "MODERATELY_ACTIVE" | "VERY_ACTIVE" | "EXTRA_ACTIVE";
  gymName?: string;
  dateOfBirth?: string | null;
  bloodGroup?: string | null;
  alternatePhone?: string | null;
  medicalConditions?: string[];
  allergies?: string[];
  injuries?: string[];
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

export async function updateMyProfile(input: UpdateProfileInput) {
  const { data } = await apiClient.patch<{ user: UserProfile }>("/users/me/profile", input);
  return data.user;
}

// Profile photos are public (shown beside chat messages) — unlike progress photos.
export async function uploadProfilePhoto(file: File) {
  const formData = new FormData();
  formData.append("photo", file);
  const { data } = await apiClient.put<{ user: UserProfile }>("/users/me/photo", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.user;
}

export async function removeProfilePhoto() {
  const { data } = await apiClient.delete<{ user: UserProfile }>("/users/me/photo");
  return data.user;
}

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

// Contact details change only after the member proves the new one with a code.
export async function sendPhoneChangeOtp(phone: string) {
  const { data } = await apiClient.post<{ phone: string; cooldownSeconds: number }>("/users/me/phone/send-otp", { phone });
  return data;
}
export async function verifyPhoneChange(phone: string, code: string) {
  const { data } = await apiClient.post<{ user: UserProfile }>("/users/me/phone/verify", { phone, code });
  return data.user;
}
export async function removeMyPhone() {
  const { data } = await apiClient.delete<{ user: UserProfile }>("/users/me/phone");
  return data.user;
}
export async function sendEmailChangeOtp(email: string) {
  const { data } = await apiClient.post<{ email: string; cooldownSeconds: number }>("/users/me/email/send-otp", { email });
  return data;
}
export async function verifyEmailChange(email: string, code: string) {
  const { data } = await apiClient.post<{ user: UserProfile }>("/users/me/email/verify", { email, code });
  return data.user;
}
