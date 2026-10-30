import type { AccountStatus, Role } from "@/lib/api";

// Display formatters shared by charts and dashboard tiles.
const dayLabel = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

// "YYYY-MM-DD" calendar date -> "29 Oct" (no timezone shift).
export const formatDay = (date: string) => dayLabel.format(new Date(`${date}T00:00:00Z`));

const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });
export const formatCompact = (n: number) => compact.format(n);

export const ROLE_LABEL: Record<Role, string> = { USER: "Member", TRAINER: "Trainer", ADMIN: "Admin" };
export const STATUS_LABEL: Record<AccountStatus, string> = { ACTIVE: "Active", SUSPENDED: "Suspended", BANNED: "Banned" };

// Enum-ish API values like WEIGHT_LOSS -> "Weight loss".
export const humanize = (value: string | null | undefined) =>
  value ? value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ") : "—";

/** Best label for a person: name, else email, else phone (mobile-only members have no email). */
export const displayName = (p: { name: string | null; email?: string | null; phone?: string | null }) => p.name || p.email || p.phone || "Member";
