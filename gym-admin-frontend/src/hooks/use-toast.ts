import { createContext, useContext } from "react";
import { isAxiosError } from "axios";

export type ToastTone = "success" | "error";

export const ToastContext = createContext<{ show: (message: string, tone?: ToastTone) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

// The backend's { error: { message } } envelope, or a fallback.
export function apiErrorMessage(err: unknown, fallback = "Something went wrong") {
  return isAxiosError(err) ? (err.response?.data?.error?.message ?? fallback) : fallback;
}
