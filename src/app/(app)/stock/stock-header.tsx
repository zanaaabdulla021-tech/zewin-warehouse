import Link from "next/link";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, ClipboardCheck, FileSpreadsheet } from "lucide-react";
import { getDict } from "@/i18n/server";
import type { SessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/card";

const ACTIONS = [
  { type: "STOCK_IN", icon: ArrowDownToLine, perm: "create" },
  { type: "STOCK_OUT", icon: ArrowUpFromLine, perm: "create" },
  { type: "TRANSFER", icon: ArrowLeftRight, perm: "create" },
  { type: "ADJUSTMENT", icon: ClipboardCheck, perm: "edit" },
] as const;

/** Shared header + tabs for the three stock screens. */
export function StockHeader({ user, active }: { user: SessionUser; active: "overview" | "movements" | "expiry" }) {
  const dict = getDict();
  const s = dict.stock;
  const actions = ACTIONS.filter((a) => can(user.permissions, "stock", a.perm));
  const tabs = [
    { key: "overview", href: "/stock", label: s.tabOverview },
    { key: "movements", href: "/stock/movements", label: s.tabMovements },
    { key: "expiry", href: "/stock/expiry", label: s.tabExpiry },
  ] as const;

  return (
    <>
      <PageHeader
        title={s.title}
        description={s.subtitle}
        actions={
          actions.length > 0 && (
            <div className="zw-scroll -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              {actions.map((a, i) => (
                <Link
                  key={a.type}
                  href={`/stock/new?type=${a.type}`}
                  className={cn(
                    "flex h-10 shrink-0 items-center gap-2 rounded-field px-4 text-[13.5px] font-medium transition-colors",
                    i === 0
                      ? "bg-brand-600 text-white hover:bg-brand-700"
                      : "border border-line-strong bg-white text-ink-soft hover:border-ink-faint hover:text-ink",
                  )}
                >
                  <a.icon className="h-4 w-4" />
                  {s.types[a.type]}
                </Link>
              ))}
              {can(user.permissions, "stock", "edit") && (
                <Link
                  href="/stock/import"
                  className="flex h-10 shrink-0 items-center gap-2 rounded-field border border-line-strong bg-white px-4 text-[13.5px] font-medium text-ink-soft hover:border-ink-faint hover:text-ink"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  {dict.importer.button}
                </Link>
              )}
            </div>
          )
        }
      />
      <nav className="zw-scroll -mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        {tabs.map((tb) => (
          <Link
            key={tb.key}
            href={tb.href}
            aria-current={active === tb.key ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-4 py-3 text-[14px] font-medium transition-colors",
              active === tb.key ? "border-brand-600 text-brand-800" : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {tb.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
