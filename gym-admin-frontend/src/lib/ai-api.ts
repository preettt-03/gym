import { apiClient } from "@/lib/api-client";

export type AiFeature = "WORKOUT_PLAN" | "DIET_PLAN" | "FORM_TIP" | "MOTIVATION" | "NUTRITION_SUGGESTION" | "CHATBOT";

export interface AiSettings {
  id: string;
  workoutPlanEnabled: boolean;
  dietPlanEnabled: boolean;
  formTipEnabled: boolean;
  motivationEnabled: boolean;
  nutritionSuggestionEnabled: boolean;
  chatbotEnabled: boolean;
  prompts: Record<string, string>;
  updatedAt: string;
}

export async function getAiSettings() {
  const { data } = await apiClient.get<{ settings: AiSettings; configured: boolean }>("/admin/ai/settings");
  return data;
}

export async function updateAiSettings(payload: Partial<Omit<AiSettings, "id" | "updatedAt" | "prompts">> & {
  prompts?: Record<string, string>;
}) {
  const { data } = await apiClient.put<{ settings: AiSettings }>("/admin/ai/settings", payload);
  return data;
}

export interface AiLogEntry {
  id: string;
  userId: string | null;
  feature: AiFeature;
  model: string;
  prompt: string;
  response: string | null;
  errorMessage: string | null;
  latencyMs: number | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string } | null;
}

export async function listAiLogs(params: { feature?: AiFeature; page?: number; limit?: number }) {
  const { data } = await apiClient.get<{ logs: AiLogEntry[]; total: number; page: number; pageSize: number }>(
    "/admin/ai/logs",
    { params }
  );
  return data;
}
