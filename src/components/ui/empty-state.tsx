import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  body,
  action,
  compact,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "px-4 py-8" : "px-6 py-16")}>
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-canvas text-ink-muted">
          {icon}
        </div>
      )}
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {body && <p className="mt-1 max-w-sm text-[13.5px] text-ink-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
