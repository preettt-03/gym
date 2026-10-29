import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Enum-style API values like WEIGHT_LOSS -> "Weight loss".
export function humanize(value: string | null | undefined) {
  return value ? value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ") : null;
}
