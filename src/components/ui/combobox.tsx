"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ComboOption = { value: string; label: string; meta?: string };

/**
 * Searchable select for large lists (warehouses, products, suppliers, employees).
 * Type to filter, ↑/↓ to move, Enter to pick, Esc to close.
 */
export function Combobox({
  id,
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  invalid,
  clearable = true,
  disabled,
  className,
  onPicked,
  triggerProps,
}: {
  id?: string;
  options: ComboOption[];
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText: string;
  invalid?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  className?: string;
  /** called after an option is chosen (e.g. move focus to the next grid cell) */
  onPicked?: (trigger: HTMLButtonElement | null) => void;
  /** extra attributes for the trigger, e.g. { "data-grid-cell": "" } */
  triggerProps?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value) ?? null;
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options.slice(0, 100);
    return options
      .filter((o) => o.label.toLowerCase().includes(s) || o.meta?.toLowerCase().includes(s))
      .slice(0, 100);
  }, [q, options]);

  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, filtered.findIndex((o) => o.value === value)));
    requestAnimationFrame(() => inputRef.current?.focus());
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pick = (o: ComboOption) => {
    onChange(o.value);
    setOpen(false);
    setQ("");
    if (onPicked) requestAnimationFrame(() => onPicked(triggerRef.current));
    else requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        {...triggerProps}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || (e.key.length === 1 && !e.metaKey && !e.ctrlKey)) {
            setOpen(true);
            if (e.key.length === 1) setQ(e.key);
          }
        }}
        className={cn("zw-field flex items-center gap-2 text-start", className)}
      >
        <span className={cn("flex-1 truncate", !selected && "text-ink-faint")}>
          {selected ? selected.label : placeholder}
        </span>
        {selected?.meta && <span className="hidden text-[12px] text-ink-faint sm:inline">{selected.meta}</span>}
        {clearable && selected && !disabled ? (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Clear"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="rounded p-0.5 text-ink-faint hover:text-ink"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        ) : (
          <ChevronsUpDown className="h-4 w-4 text-ink-faint" aria-hidden />
        )}
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-30 mt-1.5 animate-pop-in overflow-hidden rounded-xl border border-line bg-white shadow-pop">
          <div className="flex items-center gap-2 border-b border-line px-3">
            <Search className="h-4 w-4 text-ink-faint" aria-hidden />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, filtered.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const o = filtered[active];
                  if (o) pick(o);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                  triggerRef.current?.focus();
                } else if (e.key === "Tab") {
                  setOpen(false);
                }
              }}
              placeholder={searchPlaceholder ?? placeholder}
              role="combobox"
              aria-controls={listId}
              aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
              className="h-10 flex-1 bg-transparent text-[14px] outline-none placeholder:text-ink-faint"
            />
          </div>
          <ul id={listId} role="listbox" className="zw-scroll max-h-64 overflow-y-auto p-1">
            {filtered.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-ink-muted">{emptyText}</li>}
            {filtered.map((o, i) => (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={o.value === value}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-[14px]",
                  i === active && "bg-brand-50",
                )}
              >
                <span className="flex-1 truncate">{o.label}</span>
                {o.meta && <span className="text-[12px] text-ink-faint">{o.meta}</span>}
                {o.value === value && <Check className="h-4 w-4 text-brand-600" aria-hidden />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
