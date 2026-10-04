"use client";

import { cn } from "@/lib/utils";

/** Toggle with title + description, used for yes/no settings inside forms. */
export function SwitchField({
  id,
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-field border border-line p-3.5 transition-colors hover:bg-canvas/60",
        checked && "border-brand-200 bg-brand-50/40",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span className="flex-1">
        <span className="block text-[14px] font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-[12.5px] text-ink-muted">{description}</span>}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:shadow-focus focus-visible:outline-none",
          checked ? "bg-brand-600" : "bg-slate-300",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[inset-inline-start]",
            checked ? "start-[22px]" : "start-0.5",
          )}
        />
      </button>
    </label>
  );
}
