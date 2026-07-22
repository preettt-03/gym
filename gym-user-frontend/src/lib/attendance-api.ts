import { apiClient } from "@/lib/api-client";

export interface Attendance {
  id: string;
  checkInAt: string;
  checkOutAt: string | null;
  durationMinutes: number | null;
  method: "QR" | "ADMIN_APPROVED" | "BIOMETRIC";
}

export async function checkIn() {
  const { data } = await apiClient.post<{ attendance: Attendance }>("/attendance/check-in");
  return data.attendance;
}

export async function checkOut() {
  const { data } = await apiClient.post<{ attendance: Attendance }>("/attendance/check-out");
  return data.attendance;
}

export async function getStatus() {
  const { data } = await apiClient.get<{ checkedIn: boolean; attendance: Attendance | null }>("/attendance/status");
  return data;
}

export async function listMyAttendance() {
  const { data } = await apiClient.get<{ items: Attendance[] }>("/attendance/me");
  return data.items;
}
