import { cn } from "@/lib/utils";

const SIZES = { sm: "h-9 w-9 text-xs", md: "h-12 w-12 text-sm", lg: "h-24 w-24 text-2xl" };

function initials(name: string | null | undefined, email: string | null | undefined) {
  const source = name?.trim() || email || "";
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** The member's photo, or their initials on gold when they haven't added one. */
export function Avatar({
  photoUrl,
  name,
  email,
  size = "sm",
  className,
}: {
  photoUrl?: string | null;
  name?: string | null;
  email?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  if (photoUrl) {
    return (
      // Uploaded photos come from the API host; next/image would need that host whitelisted.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photoUrl} alt="" className={cn("shrink-0 rounded-full object-cover", SIZES[size], className)} />
    );
  }
  return (
    <span aria-hidden className={cn("flex shrink-0 items-center justify-center rounded-full bg-gold/15 font-semibold text-gold", SIZES[size], className)}>
      {initials(name, email)}
    </span>
  );
}
