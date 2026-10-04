"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "success" | "error" | "warning" | "info";
type Toast = { id: number; tone: Tone; title: string; body?: string };

const ToastContext = createContext<{ toast: (t: Omit<Toast, "id">) => void } | null>(null);

const tones: Record<Tone, { icon: React.ElementType; cls: string }> = {
  success: { icon: CheckCircle2, cls: "text-emerald-600" },
  error: { icon: XCircle, cls: "text-red-600" },
  warning: { icon: AlertTriangle, cls: "text-amber-500" },
  info: { icon: Info, cls: "text-sky-600" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = Date.now() + Math.random();
      setItems((xs) => [...xs.slice(-3), { ...t, id }]);
      setTimeout(() => dismiss(id), t.tone === "error" ? 6000 : 3800);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:end-0 sm:items-end"
      >
        {items.map((t) => {
          const { icon: Icon, cls } = tones[t.tone];
          return (
            <div
              key={t.id}
              role={t.tone === "error" ? "alert" : "status"}
              className="pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-xl border border-line bg-white px-4 py-3 shadow-pop"
            >
              <Icon className={cn("mt-0.5 h-[18px] w-[18px] shrink-0", cls)} aria-hidden />
              <div className="flex-1">
                <p className="text-[14px] font-medium text-ink">{t.title}</p>
                {t.body && <p className="mt-0.5 text-[13px] text-ink-muted">{t.body}</p>}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="rounded p-0.5 text-ink-faint hover:text-ink"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx.toast;
}
