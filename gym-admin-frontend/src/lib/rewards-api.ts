import { apiClient } from "@/lib/api-client";

export type RedemptionStatus = "PENDING" | "FULFILLED" | "CANCELLED";

export interface AdminRewardItem {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  costCoins: number;
  stock: number | null;
  maxPerMember: number | null;
  isActive: boolean;
  sortOrder: number;
  pending: number;
  fulfilled: number;
}

export type RewardItemInput = Pick<AdminRewardItem, "name" | "description" | "imageUrl" | "costCoins" | "stock" | "maxPerMember" | "isActive" | "sortOrder">;

export interface AdminRedemption {
  id: string;
  code: string;
  coins: number;
  status: RedemptionStatus;
  note: string | null;
  createdAt: string;
  fulfilledAt: string | null;
  cancelledAt: string | null;
  item: { id: string; name: string; imageUrl: string | null };
  user: { id: string; name: string | null; email: string | null; phone: string | null; photoUrl: string | null };
}

export async function listRewardItems() {
  const { data } = await apiClient.get<{ items: AdminRewardItem[] }>("/admin/rewards/items");
  return data.items;
}

export async function createRewardItem(input: RewardItemInput) {
  const { data } = await apiClient.post<{ item: AdminRewardItem }>("/admin/rewards/items", input);
  return data.item;
}

export async function updateRewardItem(id: string, input: Partial<RewardItemInput>) {
  const { data } = await apiClient.patch<{ item: AdminRewardItem }>(`/admin/rewards/items/${id}`, input);
  return data.item;
}

export async function deleteRewardItem(id: string) {
  const { data } = await apiClient.delete<{ archived: boolean }>(`/admin/rewards/items/${id}`);
  return data;
}

export async function listRedemptions(params: { status?: RedemptionStatus; code?: string; page?: number }) {
  const { data } = await apiClient.get<{ items: AdminRedemption[]; pagination: { page: number; totalPages: number; total: number } }>("/admin/rewards/redemptions", {
    params,
  });
  return data;
}

export async function fulfillRedemption(id: string, note?: string) {
  await apiClient.post(`/admin/rewards/redemptions/${id}/fulfill`, { note });
}

export async function cancelRedemptionAdmin(id: string, note?: string) {
  await apiClient.post(`/admin/rewards/redemptions/${id}/cancel`, { note });
}
