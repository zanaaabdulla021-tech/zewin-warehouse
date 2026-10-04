"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export type MenuItem =
  | { label: string; icon?: React.ReactNode; onSelect: () => void; danger?: boolean; hidden?: boolean }
  | "separator";

/** Three-dot row action menu. */
export function DropdownMenu({
  items,
  label = "Actions",
  trigger,
  align = "end",
}: {
  items: MenuItem[];
  label?: string;
  trigger?: React.ReactNode;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e instanceof MouseEvent && ref.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const visible = items.filter((i) => i === "separator" || !i.hidden);
  if (!visible.some((i) => i !== "separator")) return null;

  return (
    <div ref={ref} className="relative inline-block">
      {trigger ? (
        <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      ) : (
        <button
          type="button"
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          className="rounded-lg p-2 text-ink-muted hover:bg-canvas hover:text-ink"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      )}
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute top-full z-30 mt-1 min-w-[180px] animate-pop-in rounded-xl border border-line bg-white p-1 shadow-pop",
            align === "end" ? "end-0" : "start-0",
          )}
        >
          {visible.map((it, i) =>
            it === "separator" ? (
              <div key={i} className="my-1 h-px bg-line" />
            ) : (
              <button
                key={i}
                role="menuitem"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  it.onSelect();
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-[13.5px]",
                  it.danger ? "text-red-600 hover:bg-red-50" : "text-ink-soft hover:bg-canvas hover:text-ink",
                )}
              >
                {it.icon && <span className="[&_svg]:h-4 [&_svg]:w-4">{it.icon}</span>}
                {it.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
