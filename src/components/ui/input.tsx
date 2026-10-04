"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /** Leading adornment, e.g. "$" or a search icon */
  prefix?: React.ReactNode;
  /** Trailing adornment, e.g. unit "pcs" */
  suffix?: React.ReactNode;
  invalid?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { prefix, suffix, invalid, className, ...rest },
  ref,
) {
  if (!prefix && !suffix) {
    return <input ref={ref} aria-invalid={invalid || undefined} className={cn("zw-field", className)} {...rest} />;
  }
  return (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-[14px] text-ink-muted">
          {prefix}
        </span>
      )}
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn("zw-field", prefix && "ps-9", suffix && "pe-12", className)}
        {...rest}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3 text-[13px] text-ink-muted">
          {suffix}
        </span>
      )}
    </div>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ invalid, className, rows = 3, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn("zw-field h-auto resize-y py-2.5 leading-relaxed", className)}
      {...rest}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; placeholder?: string }
>(function Select({ invalid, className, placeholder, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn("zw-field zw-select cursor-pointer appearance-none pe-9", className)}
      {...rest}
    >
      {placeholder !== undefined && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {children}
    </select>
  );
});
