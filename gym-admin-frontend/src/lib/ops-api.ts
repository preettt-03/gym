import { apiClient } from "@/lib/api-client";

// --- Audit Logs ---

export interface AuditLogEntry {
  id: string;
  action: string;
  method: string;
  path: string;
  entityType: string | null;
  entityId: string | null;
  statusCode: number;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  admin: { id: string; name: string | null; email: string };
}

export async function listAuditLogs(params: { page?: number; entityType?: string; action?: string }) {
  const { data } = await apiClient.get<{
    items: AuditLogEntry[];
    pagination: { total: number; page: number; totalPages: number };
  }>("/admin/audit-logs", { params });
  return data;
}

// --- Reports ---

export type ReportType = "revenue" | "attendance" | "membership" | "users" | "workout" | "diet";
export type ReportFormat = "csv" | "xlsx" | "pdf";

export async function downloadReport(type: ReportType, format: ReportFormat, from?: string, to?: string) {
  const { data } = await apiClient.get(`/admin/reports/${type}`, {
    params: { format, from, to },
    responseType: "blob",
  });

  const url = window.URL.createObjectURL(new Blob([data]));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${type}-report.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

// --- Segments ---

export interface SegmentRules {
  fitnessGoal?: string;
  experienceLevel?: string;
  gender?: string;
  ageMin?: number;
  ageMax?: number;
  bmiMin?: number;
  bmiMax?: number;
  membershipStatus?: "ACTIVE" | "EXPIRED" | "NONE";
  inactiveDays?: number;
}

export interface Segment {
  id: string;
  name: string;
  description: string | null;
  rules: SegmentRules;
  createdAt: string;
}

export async function listSegments() {
  const { data } = await apiClient.get<{ segments: Segment[] }>("/admin/segments");
  return data.segments;
}

export async function createSegment(input: { name: string; description?: string; rules: SegmentRules }) {
  const { data } = await apiClient.post<{ segment: Segment }>("/admin/segments", input);
  return data.segment;
}

export async function deleteSegment(id: string) {
  await apiClient.delete(`/admin/segments/${id}`);
}

export interface SegmentPreview {
  count: number;
  sample: { id: string; email: string; name: string | null }[];
}

export async function previewSegment(id: string) {
  const { data } = await apiClient.get<SegmentPreview>(`/admin/segments/${id}/preview`);
  return data;
}

export async function assignWorkoutPlanToSegment(id: string, planId: string) {
  const { data } = await apiClient.post<{ assignedCount: number }>(`/admin/segments/${id}/assign-workout-plan`, {
    planId,
  });
  return data;
}

export async function assignDietPlanToSegment(id: string, planId: string) {
  const { data } = await apiClient.post<{ assignedCount: number }>(`/admin/segments/${id}/assign-diet-plan`, {
    planId,
  });
  return data;
}

export async function notifySegment(id: string, title: string, body?: string) {
  const { data } = await apiClient.post<{ notified: number }>(`/admin/segments/${id}/notify`, { title, body });
  return data;
}
