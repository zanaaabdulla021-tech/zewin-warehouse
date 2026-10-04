import { cn } from "@/lib/utils";

/** Consistent, subtle status badges used everywhere. */
const TONES = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  yellow: "bg-amber-50 text-amber-700 ring-amber-600/20",
  blue: "bg-sky-50 text-sky-700 ring-sky-600/15",
  red: "bg-red-50 text-red-700 ring-red-600/15",
  gray: "bg-slate-100 text-slate-600 ring-slate-500/15",
  brand: "bg-brand-50 text-brand-700 ring-brand-600/15",
} as const;
const DOTS = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  blue: "bg-sky-500",
  red: "bg-red-500",
  gray: "bg-slate-500",
  brand: "bg-brand-500",
} as const;

export type BadgeTone = keyof typeof TONES;

export const STATUS_TONE: Record<string, BadgeTone> = {
  ACTIVE: "green",
  VERIFIED: "green",
  PENDING: "yellow",
  DRAFT: "gray",
  PROCESSING: "blue",
  REJECTED: "red",
  INACTIVE: "gray",
  ARCHIVED: "gray",
};

export function Badge({
  tone = "gray",
  dot = true,
  children,
  className,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-medium ring-1 ring-inset",
        TONES[tone],
        className,
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", DOTS[tone])} aria-hidden />}
      {children}
    </span>
  );
}

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "gray"}>{label}</Badge>;
}
