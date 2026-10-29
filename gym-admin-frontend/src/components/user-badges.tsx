import type { AccountStatus, Role } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ROLE_LABEL, STATUS_LABEL } from "@/lib/format";

const STATUS_STYLES: Record<AccountStatus, string> = {
  ACTIVE: "bg-success/10 text-success",
  SUSPENDED: "bg-[#fab219]/10 text-[#fab219]",
  BANNED: "bg-danger/10 text-danger",
};


export function RoleBadge({ role }: { role: Role }) {
  return <span className="rounded-full bg-gold/10 px-2.5 py-1 text-xs text-gold">{ROLE_LABEL[role]}</span>;
}

export function StatusBadge({ status }: { status: AccountStatus }) {
  return <span className={cn("rounded-full px-2.5 py-1 text-xs", STATUS_STYLES[status])}>{STATUS_LABEL[status]}</span>;
}

export function Avatar({ name, email, photoUrl, size = "md" }: { name: string | null; email: string; photoUrl?: string | null; size?: "md" | "lg" }) {
  const cls = size === "lg" ? "h-16 w-16 text-2xl" : "h-10 w-10";
  if (photoUrl) {
    return <img src={photoUrl} alt="" className={cn("shrink-0 rounded-full object-cover", cls)} />;
  }
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-gold/15 font-display text-gold", cls)}>
      {(name || email).charAt(0).toUpperCase()}
    </span>
  );
}
