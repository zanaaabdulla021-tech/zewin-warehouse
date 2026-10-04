"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { cn, formatDate, formatTime } from "@/lib/utils";
import { listNotifications, markAllRead, markRead, unreadCount } from "@/app/notification-actions";

type Item = Awaited<ReturnType<typeof listNotifications>>[number];

const ICON: Record<string, { icon: React.ElementType; cls: string }> = {
  doc_submitted: { icon: Clock, cls: "bg-amber-50 text-amber-600" },
  doc_verified: { icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-600" },
  doc_rejected: { icon: XCircle, cls: "bg-red-50 text-red-600" },
};

/** Bell with unread badge. Polls every 45 s and when the tab regains focus. */
export function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const { dict } = useI18n();
  const n = dict.notifications;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(initialUnread);
  const [items, setItems] = useState<Item[] | null>(null);
  const [, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => {
    unreadCount()
      .then((c) => {
        setCount((prev) => {
          if (c > prev) router.refresh(); // new work arrived — refresh badges like "Accounting (3)"
          return c;
        });
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    const id = setInterval(refresh, 45000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    listNotifications().then(setItems).catch(() => setItems([]));
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const go = (it: Item) => {
    setOpen(false);
    if (!it.read) {
      setCount((c) => Math.max(0, c - 1));
      start(() => markRead(it.id));
    }
    if (it.link) router.push(it.link);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={n.title}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-ink-soft hover:bg-canvas"
      >
        <Bell className="h-[18px] w-[18px]" />
        {count > 0 && (
          <span className="absolute end-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-16 z-40 animate-pop-in overflow-hidden rounded-xl border border-line bg-white shadow-pop sm:absolute sm:inset-x-auto sm:end-0 sm:top-full sm:mt-1 sm:w-96">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-[14px] font-semibold">{n.title}</span>
            {count > 0 && (
              <button
                onClick={() =>
                  start(async () => {
                    await markAllRead();
                    setCount(0);
                    setItems((xs) => xs?.map((x) => ({ ...x, read: true })) ?? null);
                  })
                }
                className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand-700 hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                {n.markAllRead}
              </button>
            )}
          </div>
          <ul className="zw-scroll max-h-[60vh] overflow-y-auto">
            {items === null && <li className="px-4 py-8 text-center text-[13px] text-ink-muted">{dict.common.loading}</li>}
            {items?.length === 0 && <li className="px-4 py-10 text-center text-[13.5px] text-ink-muted">{n.empty}</li>}
            {items?.map((it) => {
              const ic = ICON[it.type] ?? ICON.doc_submitted!;
              return (
                <li key={it.id}>
                  <button
                    onClick={() => go(it)}
                    className={cn("flex w-full gap-3 border-b border-line px-4 py-3 text-start last:border-0 hover:bg-canvas", !it.read && "bg-brand-50/40")}
                  >
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", ic.cls)}>
                      <ic.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className={cn("truncate text-[13.5px]", it.read ? "text-ink-soft" : "font-semibold text-ink")}>{it.title}</span>
                        {!it.read && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                      </span>
                      {it.body && <span className="mt-0.5 line-clamp-2 block text-[12.5px] text-ink-muted">{it.body}</span>}
                      <span className="mt-1 block text-[11.5px] text-ink-faint">
                        {formatDate(it.at)} · {formatTime(it.at)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
