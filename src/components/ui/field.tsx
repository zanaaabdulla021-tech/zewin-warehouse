"use client";

import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Field = label + optional hint + control + error.
 * Every form in Zewin is built from Field inside FormSection.
 */
export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  span = 1,
  optionalLabel,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  /** columns to span inside a FormGrid: 1, 2 or "full" */
  span?: 1 | 2 | "full";
  optionalLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const hintId = htmlFor ? `${htmlFor}-hint` : undefined;
  const errId = htmlFor ? `${htmlFor}-error` : undefined;
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5",
        span === 2 && "sm:col-span-2",
        span === "full" && "col-span-full",
        className,
      )}
    >
      <label htmlFor={htmlFor} className="flex items-baseline gap-1 text-[13px] font-medium text-ink-soft">
        {label}
        {required ? (
          <span className="text-red-500" aria-hidden>
            *
          </span>
        ) : optionalLabel ? (
          <span className="text-[12px] font-normal text-ink-faint">({optionalLabel})</span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={errId} role="alert" className="flex items-center gap-1.5 text-[12.5px] font-medium text-red-600">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[12.5px] text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Responsive grid: 1 col mobile → 2 tablet → `cols` desktop. */
export function FormGrid({ cols = 2, children }: { cols?: 2 | 3; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2",
        cols === 3 && "lg:grid-cols-3",
      )}
    >
      {children}
    </div>
  );
}
