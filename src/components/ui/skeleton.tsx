import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-md bg-slate-200/70", className)} aria-hidden>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="zw-card overflow-hidden" role="status" aria-label="Loading">
      <div className="flex gap-3 border-b border-line p-4">
        <Skeleton className="h-10 w-full max-w-xs" />
        <Skeleton className="ms-auto h-10 w-24" />
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-6 border-b border-line px-5 py-4 last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn("h-4", c === 0 ? "w-40" : "w-20")} />
          ))}
        </div>
      ))}
    </div>
  );
}
