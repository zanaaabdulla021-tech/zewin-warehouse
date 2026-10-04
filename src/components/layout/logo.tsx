import { cn } from "@/lib/utils";

/** Zewin mark: a "Z" built from two stacked shelves — warehouse + ledger. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-8 w-8", className)} aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-brand-600" />
      <path d="M9 9.5h14L11.5 19.5" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M9 22.5h14" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="22.5" cy="16" r="1.8" className="fill-brand-200" />
    </svg>
  );
}

export function Logo({ tagline }: { tagline: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      <div className="leading-none">
        <div className="text-[16px] font-bold tracking-[0.14em] text-ink" dir="ltr">
          ZEWIN
        </div>
        <div className="mt-1 text-[11px] font-medium text-ink-muted">{tagline}</div>
      </div>
    </div>
  );
}
