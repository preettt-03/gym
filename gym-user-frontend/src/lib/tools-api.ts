import { apiClient } from "@/lib/api-client";

export type ToolCategory = "STRENGTH" | "NUTRITION" | "BODY_COMP" | "CARDIO" | "TRAINING";

export interface FitnessTool {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: ToolCategory;
}

/** Only the tools the admin has switched on, in their order. */
export async function listTools() {
  const { data } = await apiClient.get<{ tools: FitnessTool[] }>("/tools");
  return data.tools;
}

export async function getTool(slug: string) {
  const { data } = await apiClient.get<{ tool: FitnessTool }>(`/tools/${encodeURIComponent(slug)}`);
  return data.tool;
}
