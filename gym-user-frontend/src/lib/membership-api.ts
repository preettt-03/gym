import { apiClient } from "@/lib/api-client";

export interface MembershipPlan {
  id: string;
  name: string;
  description: string | null;
  durationDays: number;
  price: number;
  discountPercent: number | null;
  benefits: string[];
}

export async function listMembershipPlans() {
  const { data } = await apiClient.get<{ plans: MembershipPlan[] }>("/membership-plans");
  return data.plans;
}

export type MembershipStatus = "ACTIVE" | "EXPIRED" | "CANCELLED";
export type PaymentGateway = "RAZORPAY" | "STRIPE" | "UPI" | "CARD" | "WALLET";

export interface Membership {
  id: string;
  planId: string;
  startDate: string;
  endDate: string;
  status: MembershipStatus;
  plan: MembershipPlan;
}

export async function getMyMembership() {
  const { data } = await apiClient.get<{ hasMembership: boolean; isActive: boolean; membership: Membership | null }>(
    "/memberships/me"
  );
  return data;
}

export async function checkout(planId: string, gateway: PaymentGateway) {
  const { data } = await apiClient.post("/memberships/checkout", { planId, gateway });
  return data;
}

export interface Payment {
  id: string;
  amount: number;
  currency: string;
  gateway: PaymentGateway;
  status: string;
  invoiceNumber: string | null;
  createdAt: string;
  plan: MembershipPlan;
}

export async function listMyPayments() {
  const { data } = await apiClient.get<{ payments: Payment[] }>("/payments/me");
  return data.payments;
}

export async function getInvoice(paymentId: string) {
  const { data } = await apiClient.get(`/payments/me/${paymentId}/invoice`);
  return data;
}

export async function downloadInvoicePdf(paymentId: string, invoiceNumber?: string | null) {
  const { data } = await apiClient.get(`/payments/me/${paymentId}/invoice.pdf`, {
    responseType: "blob",
  });

  const url = window.URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `invoice-${invoiceNumber || paymentId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
