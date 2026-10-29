import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn("skeleton rounded-lg", className)} {...props} />;
}

// Generic list placeholder used while a page's query is loading.
export function SkeletonList({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div role="status" aria-label="Loading" className={cn("flex flex-col gap-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="glass-card flex flex-col gap-3 p-6">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonGrid({
  count = 6,
  className,
  itemClassName = "aspect-square",
}: {
  count?: number;
  className?: string;
  itemClassName?: string;
}) {
  return (
    <div role="status" aria-label="Loading" className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cn("rounded-2xl", itemClassName)} />
      ))}
    </div>
  );
}
