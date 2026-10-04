"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Accessible modal. Escape closes, focus moves inside, body scroll locks.
 * On mobile it docks to the bottom like a native sheet.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  dismissible?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  // keep the latest callbacks without re-running the open/close effect on every render
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dismissibleRef = useRef(dismissible);
  dismissibleRef.current = dismissible;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismissibleRef.current && onCloseRef.current();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    const first = panelRef.current?.querySelector<HTMLElement>(
      "input:not([type=hidden]),select,textarea,button[data-autofocus]",
    );
    (first ?? panelRef.current)?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 animate-fade-in bg-ink/40 backdrop-blur-[2px]"
        onClick={() => dismissible && onClose()}
        aria-hidden
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="zw-modal-title"
        className={cn(
          "relative flex max-h-[92dvh] w-full animate-pop-in flex-col overflow-hidden rounded-t-2xl bg-white shadow-pop outline-none sm:rounded-card",
          size === "sm" && "sm:max-w-md",
          size === "md" && "sm:max-w-lg",
          size === "lg" && "sm:max-w-2xl",
        )}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line-strong sm:hidden" aria-hidden />
        <header className="flex items-start gap-4 px-6 pb-2 pt-5">
          <div className="flex-1">
            <h2 id="zw-modal-title" className="text-[17px] font-semibold text-ink">
              {title}
            </h2>
            {description && <p className="mt-1 text-[13.5px] text-ink-muted">{description}</p>}
          </div>
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              className="-me-2 -mt-1 rounded-lg p-2 text-ink-muted hover:bg-canvas hover:text-ink"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </header>
        <div className="zw-scroll flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer && (
          <footer className="flex flex-col-reverse gap-2 border-t border-line bg-canvas/60 px-6 py-4 sm:flex-row sm:justify-end [&_button]:h-12 sm:[&_button]:h-10">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
