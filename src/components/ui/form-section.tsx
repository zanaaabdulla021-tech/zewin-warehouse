"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A titled block of a large form. On desktop the title/description sit in a
 * left rail; on mobile it stacks and can be collapsed.
 */
export function FormSection({
  title,
  description,
  icon,
  children,
  collapsible = true,
  defaultOpen = true,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="grid gap-5 border-b border-line px-5 py-6 last:border-b-0 sm:px-7 lg:grid-cols-[240px_1fr] lg:gap-10">
      <header>
        <button
          type="button"
          onClick={() => collapsible && setOpen((o) => !o)}
          className="flex w-full items-start gap-3 text-start lg:pointer-events-none"
          aria-expanded={open}
        >
          {icon && (
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              {icon}
            </span>
          )}
          <span className="flex-1">
            <span className="block text-[15px] font-semibold text-ink">{title}</span>
            {description && <span className="mt-1 block text-[13px] leading-relaxed text-ink-muted">{description}</span>}
          </span>
          {collapsible && (
            <ChevronDown
              className={cn("mt-1 h-4 w-4 text-ink-muted transition-transform lg:hidden", !open && "-rotate-90")}
              aria-hidden
            />
          )}
        </button>
      </header>
      <div className={cn(!open && "hidden lg:block")}>{children}</div>
    </section>
  );
}

/** Sticky action bar at the bottom of a form page. Large tap targets on mobile. */
export function FormActions({ children, start }: { children: React.ReactNode; start?: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 flex flex-col-reverse gap-2 rounded-b-card border-t border-line bg-white/95 px-5 py-4 backdrop-blur sm:flex-row sm:items-center sm:px-7 [&_button]:h-12 sm:[&_button]:h-10">
      <div className="flex-1 text-[13px] text-ink-muted">{start}</div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row">{children}</div>
    </div>
  );
}
