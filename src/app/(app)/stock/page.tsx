import { AlertTriangle, Boxes, CalendarClock, DollarSign, Package } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getDict } from "@/i18n/server";
import { getAppSettings } from "@/lib/settings";
import { cn, formatMoney, formatNumber } from "@/lib/utils";
import { Forbidden } from "@/components/layout/module-states";
import { StockHeader } from "./stock-header";
import { StockTable, type StockRow } from "./stock-table";

export const metadata = { title: "Stock" };

const DAY = 86400000;

export default async function StockPage({ searchParams }: { searchParams: { wh?: string; filter?: string } }) {
  const user = await getSessionUser();
  if (!can(user.permissions, "stock")) return <Forbidden />;
  const dict = getDict();
  const s = dict.stock;
  const { expiryWarningDays: warnDays } = await getAppSettings();

  const warehouses = await prisma.warehouse.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });
  const wh = warehouses.find((w) => w.id === searchParams.wh)?.id;

  const levels = await prisma.stockLevel.findMany({
    where: { quantity: { gt: 0 }, ...(wh ? { warehouseId: wh } : {}) },
    include: {
      warehouse: { select: { id: true, name: true, code: true } },
      product: { select: { id: true, name: true, code: true, minQuantity: true, purchasePrice: true, unit: { select: { symbol: true } } } },
      batch: { select: { number: true, expiryDate: true } },
    },
    orderBy: [{ product: { name: "asc" } }],
  });

  // product totals (for low-stock status) across the current scope
  const totals = new Map<string, number>();
  for (const l of levels) totals.set(l.productId, (totals.get(l.productId) ?? 0) + Number(l.quantity));

  const now = Date.now();
  const rows: StockRow[] = levels.map((l) => {
    const qty = Number(l.quantity);
    const exp = l.batch?.expiryDate ?? null;
    const days = exp ? Math.floor((+exp - now) / DAY) : null;
    const min = Number(l.product.minQuantity);
    const status: StockRow["status"] =
      days !== null && days < 0 ? "EXPIRED" : days !== null && days <= warnDays ? "EXPIRING" : min > 0 && (totals.get(l.productId) ?? 0) < min ? "LOW" : "OK";
    return {
      id: l.id,
      productId: l.product.id,
      product: l.product.name,
      code: l.product.code,
      unit: l.product.unit?.symbol ?? "",
      warehouseId: l.warehouse.id,
      warehouse: l.warehouse.name,
      batch: l.batch?.number ?? null,
      expiry: exp ? exp.toISOString() : null,
      days,
      qty,
      value: qty * Number(l.product.purchasePrice),
      status,
    };
  });

  const totalUnits = rows.reduce((a, r) => a + r.qty, 0);
  const totalValue = rows.reduce((a, r) => a + r.value, 0);
  const skus = new Set(rows.map((r) => r.productId)).size;
  const expiring = rows.filter((r) => r.status === "EXPIRING").length;
  const expired = rows.filter((r) => r.status === "EXPIRED").length;

  const kpis = [
    { label: s.totalUnits, value: formatNumber(totalUnits), icon: Boxes },
    { label: s.totalValue, value: formatMoney(totalValue), icon: DollarSign },
    { label: s.skus, value: formatNumber(skus), icon: Package },
    { label: s.expiringSoon, value: formatNumber(expiring), icon: CalendarClock, tone: expiring ? "amber" : undefined },
    { label: s.expired, value: formatNumber(expired), icon: AlertTriangle, tone: expired ? "red" : undefined },
  ];

  return (
    <>
      <StockHeader user={user} active="overview" />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="zw-card p-4 last:col-span-2 lg:last:col-span-1">
            <div className="flex items-center gap-2 text-[12.5px] font-medium text-ink-muted">
              <k.icon className={cn("h-4 w-4", k.tone === "amber" ? "text-amber-500" : k.tone === "red" ? "text-red-500" : "text-brand-600")} />
              {k.label}
            </div>
            <div
              className={cn(
                "mt-2 text-[20px] font-semibold tracking-tight tabular sm:text-[22px]",
                k.tone === "amber" && "text-amber-700",
                k.tone === "red" && "text-red-600",
              )}
              dir="ltr"
            >
              {k.value}
            </div>
          </div>
        ))}
      </div>
      <StockTable
        rows={rows}
        warehouses={warehouses.map((w) => ({ value: w.id, label: w.name }))}
        warehouseId={wh ?? ""}
        initialFilter={searchParams.filter?.toUpperCase()}
        canExport={can(user.permissions, "stock", "export")}
      />
    </>
  );
}
