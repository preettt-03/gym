import Image from "next/image";
import { cn } from "@/lib/utils";
import logo from "@/assets/images/logo.png";

// The official King's Fitness badge, cut out to a transparent circle.
export function LogoMark({ className, preload = false }: { className?: string; preload?: boolean }) {
  return (
    <Image
      src={logo}
      alt=""
      sizes="96px"
      preload={preload}
      className={cn("h-10 w-10 rounded-full object-contain", className)}
    />
  );
}

export function Logo({ className, compact = false, preload = false }: { className?: string; compact?: boolean; preload?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="h-11 w-11 shrink-0" preload={preload} />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-lg font-bold uppercase tracking-wider text-gold">King&apos;s</span>
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-foreground">Fitness</span>
        </span>
      )}
    </span>
  );
}
