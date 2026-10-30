import { apiClient } from "@/lib/api-client";
import type { AdminUserDetail } from "@/lib/api";

export type MembershipStatus = "ACTIVE" | "EXPIRED" | "CANCELLED" | "FROZEN";
export type DeskMethod = "CASH" | "UPI" | "CARD" | "RAZORPAY";

export interface MemberAlert {
  kind: "INACTIVE" | "EXPIRING" | "EXPIRED";
  days: number;
  date: string | null;
}

/** Everything the member page shows: the base detail plus CRM fields and insights. */
export interface MemberDetail extends AdminUserDetail {
  phone: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  tags: string[];
  lockerNumber: string | null;
  rfidTagId: string | null;
  ptSessionsTotal: number;
  ptSessionsUsed: number;
  membership: {
    id: string;
    status: MembershipStatus;
    startDate: string;
    endDate: string;
    frozenAt: string | null;
    resumeAt: string | null;
    plan: { id: string; name: string; durationDays: number; price: number };
    totalDays: number;
    daysRemaining: number;
  } | null;
  alerts: MemberAlert[];
  lastVisitAt: string | null;
  memberForDays: number;
  attendanceHeatmap: { days: number; counts: Record<string, number>; streak: number };
  weightSeries: { weightKg: number; loggedAt: string }[];
  gamification: {
    streak: { currentStreak: number; longestStreak: number };
    badges: { id: string; name: string; iconUrl: string | null; awardedAt: string }[];
    missions: { active: number; completed: number };
  };
  ptRecent: { id: string; completedAt: string; trainer: { name: string | null; email: string } | null }[];
  plans: {
    workout: { assignmentId: string; assignedAt: string; id: string; title: string; difficulty: string; estimatedMinutes: number | null; daysPerWeek: number }[];
    diet: { assignmentId: string; assignedAt: string; id: string; title: string; calories: number; macros: { protein: number; carbs: number; fat: number } }[];
  };
}

export async function getMemberDetail(id: string) {
  const { data } = await apiClient.get<{ user: MemberDetail }>(`/admin/users/${id}`);
  return data.user;
}

const base = (id: string) => `/admin/users/${id}`;

export interface ProfileInput {
  name?: string;
  age?: number | null;
  gender?: "MALE" | "FEMALE" | "OTHER" | null;
  heightCm?: number | null;
  targetWeightKg?: number | null;
  phone?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
}

export const updateMemberProfile = (id: string, input: ProfileInput) => apiClient.patch(`${base(id)}/profile`, input);
export const setMemberTags = (id: string, tags: string[]) => apiClient.put<{ tags: string[] }>(`${base(id)}/tags`, { tags }).then((r) => r.data.tags);
export const setFacility = (id: string, input: { lockerNumber?: string | null; rfidTagId?: string | null }) => apiClient.put(`${base(id)}/facility`, input);
export const manualCheckIn = (id: string) => apiClient.post(`${base(id)}/check-in`);

export const extendMembership = (id: string, days: number) => apiClient.post(`${base(id)}/membership/extend`, { days });
export const freezeMembership = (id: string, resumeAt: string, reason?: string) => apiClient.post(`${base(id)}/membership/freeze`, { resumeAt, reason: reason || undefined });
export const unfreezeMembership = (id: string) => apiClient.post(`${base(id)}/membership/unfreeze`);
export const cancelMembership = (id: string, reason: string) => apiClient.post(`${base(id)}/membership/cancel`, { reason });

export interface MemberPayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  gateway: string;
  invoiceNumber: string | null;
  reference: string | null;
  note: string | null;
  desk: boolean;
  createdAt: string;
  plan: { name: string };
}

interface Page<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export const recordPayment = (id: string, input: { planId: string; amount: number; method: DeskMethod; reference?: string | null; note?: string | null }) =>
  apiClient.post(`${base(id)}/payments`, input);
export const listMemberPayments = (id: string, page: number, limit = 10) =>
  apiClient.get<Page<MemberPayment>>(`${base(id)}/payments`, { params: { page, limit } }).then((r) => r.data);

/** Fetches the PDF with the admin's token and hands it to the browser as a download. */
export async function downloadInvoice(id: string, paymentId: string, invoiceNumber: string | null) {
  const { data } = await apiClient.get<Blob>(`${base(id)}/payments/${paymentId}/invoice`, { responseType: "blob" });
  const url = URL.createObjectURL(data);
  const a = Object.assign(document.createElement("a"), { href: url, download: `invoice-${invoiceNumber ?? paymentId}.pdf` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface MemberVisit {
  id: string;
  checkInAt: string;
  checkOutAt: string | null;
  durationMinutes: number | null;
  method: string;
  approvedByAdmin: { name: string | null; email: string } | null;
}
export const listMemberVisits = (id: string, page: number, limit = 15) =>
  apiClient.get<Page<MemberVisit>>(`${base(id)}/visits`, { params: { page, limit } }).then((r) => r.data);

export const setPtPackage = (id: string, total: number) => apiClient.put(`${base(id)}/pt/package`, { total });
export const completePtSession = (id: string) => apiClient.post(`${base(id)}/pt/complete`);

export const sendNudge = (id: string, kind: "INACTIVE" | "EXPIRING") => apiClient.post(`${base(id)}/nudge`, { kind });
export const revokeSessions = (id: string, reason: string) => apiClient.post<{ revoked: number }>(`${base(id)}/sessions/revoke`, { reason }).then((r) => r.data.revoked);
export const resendVerification = (id: string) => apiClient.post<{ message: string }>(`${base(id)}/resend-verification`).then((r) => r.data.message);

export interface StaffNote {
  id: string;
  body: string;
  followUpDate: string | null;
  isDone: boolean;
  createdAt: string;
  author: { id: string; name: string | null; email: string };
}
export const listNotes = (id: string) => apiClient.get<{ notes: StaffNote[] }>(`${base(id)}/notes`).then((r) => r.data.notes);
export const addNote = (id: string, body: string, followUpDate: string | null) =>
  apiClient.post<{ note: StaffNote }>(`${base(id)}/notes`, { body, followUpDate }).then((r) => r.data.note);
export const updateNote = (id: string, noteId: string, patch: { isDone?: boolean; body?: string; followUpDate?: string | null }) =>
  apiClient.patch<{ note: StaffNote }>(`${base(id)}/notes/${noteId}`, patch).then((r) => r.data.note);
export const deleteNote = (id: string, noteId: string) => apiClient.delete(`${base(id)}/notes/${noteId}`);

export interface MedicalDetails {
  medicalConditions: string[];
  allergies: string[];
  medicalNotes: string | null;
  viewLog: { at: string; by: string }[];
}
export const revealMedical = (id: string) => apiClient.post<{ medical: MedicalDetails }>(`${base(id)}/medical/reveal`).then((r) => r.data.medical);
export const updateMedical = (id: string, input: { medicalConditions?: string[]; allergies?: string[]; medicalNotes?: string | null }) =>
  apiClient.patch(`${base(id)}/medical`, input);

export interface TimelineItem {
  id: string;
  kind: "CHECK_IN" | "WORKOUT" | "PAYMENT" | "PLAN" | "PT" | "ADMIN";
  at: string;
  title: string;
  detail: string | null;
}
export const getTimeline = (id: string, before?: string) =>
  apiClient.get<{ items: TimelineItem[]; nextBefore: string | null }>(`${base(id)}/timeline`, { params: { before } }).then((r) => r.data);

export const unassignWorkoutPlan = (planId: string, userId: string) => apiClient.delete(`/admin/workout-plans/${planId}/assign/${userId}`);
export const unassignDietPlan = (planId: string, userId: string) => apiClient.delete(`/admin/diet-plans/${planId}/assign/${userId}`);
