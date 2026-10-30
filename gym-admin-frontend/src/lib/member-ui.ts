import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage, useToast } from "@/hooks/use-toast";

export const TZ = "Asia/Kolkata";
export const fmtDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
export const fmtDateTime = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: TZ });
export const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
export const textareaClass =
  "glass-input w-full resize-y px-4 py-3 text-sm outline-none placeholder:text-muted focus:border-gold/60 focus:ring-2 focus:ring-gold/25";

/** "YYYY-MM-DD" for <input type="date"> in IST, `days` from today. */
export function istDateInput(days = 0) {
  return new Date(Date.now() + days * 86_400_000 + 5.5 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * A mutation for one member: on success it refreshes the member page (and
 * its timeline) and toasts; on failure it toasts the API's message.
 */
export function useMemberAction<TVars = void, TData = unknown>(
  memberId: string,
  fn: (vars: TVars) => Promise<TData>,
  { success, error, onDone }: { success: string | ((data: TData, vars: TVars) => string); error: string; onDone?: (data: TData) => void }
) {
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-user", memberId] });
      queryClient.invalidateQueries({ queryKey: ["member-timeline", memberId] });
      queryClient.invalidateQueries({ queryKey: ["member-payments", memberId] });
      queryClient.invalidateQueries({ queryKey: ["member-visits", memberId] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.show(typeof success === "function" ? success(data, vars) : success);
      onDone?.(data);
    },
    onError: (err) => toast.show(apiErrorMessage(err, error), "error"),
  });
}


/** wa.me wants digits only, with the country code (default India). */
export function whatsAppLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  const full = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}


/** Short, readable member number printed on the card (and scannable via the QR). */
export function memberCode(id: string) {
  return `KF-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}


export const METHOD_LABEL: Record<string, string> = { CASH: "Cash", UPI: "UPI", CARD: "Card", RAZORPAY: "Razorpay", STRIPE: "Stripe", WALLET: "Wallet" };
