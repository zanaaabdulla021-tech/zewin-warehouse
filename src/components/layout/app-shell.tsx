"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronsUpDown, Globe, LogOut, Menu, Search, UserRound, X } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn, initials } from "@/lib/utils";
import { can, type PermissionSet } from "@/lib/permissions";
import { useI18n } from "@/i18n/client";
import { LOCALES, LOCALE_LABELS } from "@/i18n/config";
import { setLocale } from "@/app/actions";
import { NAV } from "./nav-config";
import { Logo } from "./logo";
import { NotificationBell } from "./notification-bell";

type ShellUser = { id: string; name: string; email: string; roleName: string };

export function AppShell({
  user,
  permissions,
  pendingVerification,
  unreadNotifications,
  children,
}: {
  user: ShellUser;
  permissions: PermissionSet;
  pendingVerification: number;
  unreadNotifications: number;
  children: React.ReactNode;
}) {
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();

  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
  }, [drawer]);

  const sidebar = (
    <Sidebar
      user={user}
      permissions={permissions}
      pendingVerification={pendingVerification}
      onClose={() => setDrawer(false)}
    />
  );

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-[264px] border-e border-line bg-white lg:block print:!hidden">{sidebar}</aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-ink/40" onClick={() => setDrawer(false)} aria-hidden />
          <aside className="absolute inset-y-0 start-0 w-[86%] max-w-[300px] animate-slide-in bg-white shadow-pop [--drawer-from:-100%] rtl:[--drawer-from:100%]">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:ps-[264px] print:!ps-0">
        <Topbar onMenu={() => setDrawer(true)} unread={unreadNotifications} />
        <main className="mx-auto w-full max-w-[1400px] px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-10 print:max-w-none print:p-0">{children}</main>
      </div>
    </div>
  );
}

function Sidebar({
  user,
  permissions,
  pendingVerification,
  onClose,
}: {
  user: ShellUser;
  permissions: PermissionSet;
  pendingVerification: number;
  onClose: () => void;
}) {
  const { dict } = useI18n();
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const [busy, start] = useTransition();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Link href="/">
          <Logo tagline={dict.app.tagline} />
        </Link>
        <button onClick={onClose} className="rounded-lg p-2 text-ink-muted hover:bg-canvas lg:hidden" aria-label={dict.common.close}>
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="zw-scroll flex-1 overflow-y-auto px-3 py-2" aria-label="Main">
        {NAV.map((group, gi) => {
          const items = group.items.filter((i) => can(permissions, i.module, "view"));
          if (!items.length) return null;
          return (
            <div key={gi} className="mb-4">
              {group.label && (
                <div className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
                  {dict.nav[group.label]}
                </div>
              )}
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group relative flex h-10 items-center gap-3 rounded-lg px-3 text-[14px] font-medium transition-colors",
                          active ? "bg-brand-50 text-brand-800" : "text-ink-soft hover:bg-canvas hover:text-ink",
                        )}
                      >
                        {active && <span className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-brand-600" aria-hidden />}
                        <Icon className={cn("h-[18px] w-[18px]", active ? "text-brand-600" : "text-ink-muted group-hover:text-ink-soft")} />
                        <span className="flex-1">{dict.nav[item.label]}</span>
                        {item.module === "accounting" && pendingVerification > 0 && (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
                            {pendingVerification}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Profile */}
      <div className="relative border-t border-line p-3">
        {menu && (
          <div className="absolute inset-x-3 bottom-full mb-2 animate-pop-in rounded-xl border border-line bg-white p-1 shadow-pop">
            <div className="px-3 py-2">
              <div className="truncate text-[13px] font-medium text-ink">{user.name}</div>
              <div className="truncate text-[12px] text-ink-muted" dir="ltr">{user.email}</div>
            </div>
            <div className="my-1 h-px bg-line" />
            <Link
              href="/account"
              onClick={() => setMenu(false)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-ink-soft hover:bg-canvas"
            >
              <UserRound className="h-4 w-4" />
              {dict.settings.tabAccount}
            </Link>
            <button
              disabled={busy}
              onClick={() => start(() => signOut({ callbackUrl: "/login" }))}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              {dict.common.logout}
            </button>
          </div>
        )}
        <button
          onClick={() => setMenu((m) => !m)}
          aria-expanded={menu}
          className="flex w-full items-center gap-3 rounded-xl p-2 text-start hover:bg-canvas"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-[13px] font-semibold text-white">
            {initials(user.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold text-ink">{user.name}</span>
            <span className="block truncate text-[12px] text-ink-muted">{user.roleName}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 text-ink-faint" />
        </button>
      </div>
    </div>
  );
}

function Topbar({ onMenu, unread }: { onMenu: () => void; unread: number }) {
  const { dict, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();

  return (
    <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white/85 px-4 backdrop-blur sm:px-6 lg:px-8">
      <button onClick={onMenu} className="-ms-1 rounded-lg p-2 text-ink-soft hover:bg-canvas lg:hidden" aria-label="Menu">
        <Menu className="h-5 w-5" />
      </button>

      <div className="relative hidden max-w-md flex-1 sm:block">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <input
          className="h-10 w-full rounded-field border border-transparent bg-canvas ps-9 pe-14 text-[14px] outline-none placeholder:text-ink-faint focus:border-brand-500 focus:bg-white focus:shadow-focus"
          placeholder={dict.common.searchEverything}
          aria-label={dict.common.searchEverything}
        />
        <kbd className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 rounded border border-line bg-white px-1.5 text-[11px] text-ink-faint" dir="ltr">
          ⌘K
        </kbd>
      </div>

      <div className="ms-auto flex items-center gap-1">
        <NotificationBell initialUnread={unread} />
        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label={dict.common.language}
            aria-expanded={open}
            className="flex h-10 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-soft hover:bg-canvas"
          >
            <Globe className="h-4 w-4" />
            {LOCALE_LABELS[locale].short}
          </button>
          {open && (
            <div className="absolute end-0 top-full z-30 mt-1 w-40 animate-pop-in rounded-xl border border-line bg-white p-1 shadow-pop">
              {LOCALES.map((l) => (
                <button
                  key={l}
                  onClick={() =>
                    start(async () => {
                      setOpen(false);
                      await setLocale(l);
                    })
                  }
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[14px] hover:bg-canvas"
                >
                  {LOCALE_LABELS[l].native}
                  {l === locale && <Check className="h-4 w-4 text-brand-600" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
