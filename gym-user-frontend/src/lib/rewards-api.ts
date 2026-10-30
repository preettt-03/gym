import { apiClient } from "@/lib/api-client";

export type BlockedReason = "OUT_OF_STOCK" | "LIMIT_REACHED" | "NOT_ENOUGH_COINS";
export type RedemptionStatus = "PENDING" | "FULFILLED" | "CANCELLED";

export interface RewardItem {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  costCoins: number;
  stock: number | null;
  maxPerMember: number | null;
  redeemedByMe: number;
  canRedeem: boolean;
  blockedReason: BlockedReason | null;
}

export interface Redemption {
  id: string;
  code: string;
  coins: number;
  status: RedemptionStatus;
  note: string | null;
  createdAt: string;
  fulfilledAt: string | null;
  cancelledAt: string | null;
  item: { id: string; name: string; imageUrl: string | null };
}

export async function getRewardsStore() {
  const { data } = await apiClient.get<{ coins: number; xp: number; items: RewardItem[] }>("/rewards");
  return data;
}

export async function redeemReward(itemId: string) {
  const { data } = await apiClient.post<{ redemption: Redemption }>(`/rewards/${itemId}/redeem`);
  return data.redemption;
}

export async function listMyRedemptions() {
  const { data } = await apiClient.get<{ redemptions: Redemption[] }>("/rewards/redemptions");
  return data.redemptions;
}

export async function cancelRedemption(id: string) {
  await apiClient.post(`/rewards/redemptions/${id}/cancel`);
}
