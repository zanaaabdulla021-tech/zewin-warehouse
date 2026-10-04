import Link from "next/link";
import { CalendarCheck2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getDict } from "@/i18n/server";
import { interpolate as t } from "@/i18n/config";
import { cn, formatDate, formatMoney, formatNumber } from "@/lib/utils";
import { Forbidden } from "@/components/layout/module-states";
import { EmptyState } from "@/components/ui/empty-state";
import { StockHeader } from "../stock-header";

export const metadata = { title: "Batches & expiry" };
const DAY = 86400000;

const BUCKETS = [
  { key: "expired", max: -1, tone: "red", label: (d: ReturnType<typeof getDict>) => d.stock.expired },
  { key: "30", max: 30, tone: "red", label: () => "≤ 30" },
  { key: "60", max: 60, tone: "amber", label: () => "31 – 60" },
  { key: "90", max: 90, tone: "amber", label: () => "61 – 90" },
  { key: "later", max: Infinity, tone: "green", label: () => "> 90" },
] as const;

export default async function ExpiryPage() {
  const user = await getSessionUser();
  if (!can(user.permissions, "stock")) return <Forbidden />;
  const dict = getDict();
  const s = dict.stock;

  const levels = await prisma.stockLevel.findMany({
    where: { quantity: { gt: 0 }, batch: { expiryDate: { not: null } } },
    include: {
      warehouse: { select: { id: true, name: true } },
      product: { select: { id: true, name: true, purchasePrice: true, unit: { select: { symbol: true } } } },
      batch: { select: { number: true, expiryDate: true } },
    },
    orderBy: { batch: { expiryDate: "asc" } },
  });

  const now = Date.now();
  const items = levels.map((l) => {
    const days = Math.floor((+l.batch!.expiryDate! - now) / DAY);
    return {
      id: l.id,
      productId: l.product.id,
      product: l.product.name,
      unit: l.product.unit?.symbol ?? "",
      warehouse: l.warehouse.name,
      batch: l.batch!.number,
      expiry: l.batch!.expiryDate!,
      days,
      qty: Number(l.quantity),
      value: Number(l.quantity) * Number(l.product.purchasePrice),
    };
  });

  const grouped = BUCKETS.map((b, i) => {
    const min = i === 0 ? -Infinity : BUCKETS[i - 1]!.max + 1;
    const list = items.filter((x) => x.days >= min && x.days <= b.max);
    return { ...b, list, value: list.reduce((a, x) => a + x.value, 0) };
  });

  return (
    <>
      <StockHeader user={user} active="expiry" />
      {items.length === 0 ? (
        <div className="zw-card">
          <EmptyState icon={<CalendarCheck2 className="h-5 w-5" />} title={s.expiryEmpty} />
        </div>
      ) : (
        <>
          {/* bucket summary */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {grouped.map((g) => (
              <a
                key={g.key}
                href={`#b-${g.key}`}
                className={cn(
                  "zw-card border-t-[3px] p-4 transition-shadow hover:shadow-pop",
                  g.tone === "red" ? "border-t-red-400" : g.tone === "amber" ? "border-t-amber-400" : "border-t-emerald-400",
                )}
              >
                <div className="text-[12.5px] font-medium text-ink-muted" dir={g.key === "expired" ? undefined : "ltr"}>
                  {g.label(dict)}
                  {g.key !== "expired" && " d"}
                </div>
                <div className="mt-1 text-[22px] font-semibold tabular">{g.list.length}</div>
                <div className="text-[12px] text-ink-muted" dir="ltr">{formatMoney(g.value)}</div>
              </a>
            ))}
          </div>

          <div className="space-y-6">
            {grouped
              .filter((g) => g.list.length)
              .map((g) => (
                <section key={g.key} id={`b-${g.key}`} className="zw-card scroll-mt-20 overflow-hidden">
                  <header className="flex items-center gap-3 border-b border-line px-5 py-3.5">
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        g.tone === "red" ? "bg-red-500" : g.tone === "amber" ? "bg-amber-500" : "bg-emerald-500",
                      )}
                    />
                    <h2 className="flex-1 text-[15px] font-semibold">
                      <span dir={g.key === "expired" ? undefined : "ltr"}>
                        {g.label(dict)}
                        {g.key !== "expired" && " d"}
                      </span>
                    </h2>
                    <span className="text-[13px] text-ink-muted">{g.list.length}</span>
                  </header>
                  <ul className="divide-y divide-line">
                    {g.list.map((x) => (
                      <li key={x.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                        <div className="min-w-0 flex-1">
                          <Link href={`/products/${x.productId}`} className="block truncate font-medium text-ink hover:text-brand-700">
                            {x.product}
                          </Link>
                          <div className="text-[12.5px] text-ink-muted">
                            <span className="font-mono" dir="ltr">{x.batch}</span> · {x.warehouse}
                          </div>
                        </div>
                        <div className="text-end">
                          <div className={cn("text-[13.5px] font-medium", x.days < 0 ? "text-red-600" : x.days <= 60 ? "text-amber-700" : "text-ink-soft")}>
                            {formatDate(x.expiry)}
                          </div>
                          <div className="text-[12px] text-ink-muted">
                            {x.days < 0 ? t(s.expiredAgo, { n: -x.days }) : t(s.daysLeft, { n: x.days })}
                          </div>
                        </div>
                        <div className="w-28 text-end" dir="ltr">
                          <div className="font-semibold">
                            {formatNumber(x.qty)} <span className="text-[12px] font-normal text-ink-muted">{x.unit}</span>
                          </div>
                          <div className="text-[12px] text-ink-muted">{formatMoney(x.value)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
          </div>
        </>
      )}
    </>
  );
}
