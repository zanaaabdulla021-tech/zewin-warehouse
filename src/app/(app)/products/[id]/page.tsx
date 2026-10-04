import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Boxes, CalendarClock, ChevronLeft, DollarSign, Warehouse } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getDict } from "@/i18n/server";
import { cn, formatDate, formatMoney, formatNumber, formatTime, initials } from "@/lib/utils";
import { Forbidden } from "@/components/layout/module-states";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductThumb } from "../product-list";
import { ProductDetailActions } from "./detail-actions";

export default async function ProductDetailsPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!can(user.permissions, "products")) return <Forbidden />;
  const dict = getDict();
  const p = dict.products;

  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: {
      category: { select: { name: true } },
      unit: { select: { name: true, symbol: true } },
      stock: {
        where: { quantity: { gt: 0 } },
        include: {
          warehouse: { select: { id: true, name: true, code: true } },
          batch: { select: { number: true, expiryDate: true } },
        },
        orderBy: [{ warehouse: { name: "asc" } }],
      },
    },
  });
  if (!product) notFound();

  const activity = await prisma.auditLog.findMany({
    where: { module: "products", OR: [{ recordId: product.id }, { recordRef: product.code }] },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  const buy = Number(product.purchasePrice);
  const sell = Number(product.sellingPrice);
  const min = Number(product.minQuantity);
  const qty = product.stock.reduce((s, x) => s + Number(x.quantity), 0);
  const value = qty * buy;
  const whCount = new Set(product.stock.map((s) => s.warehouseId)).size;
  const expiries = product.stock.map((s) => s.batch?.expiryDate).filter((d): d is Date => !!d).sort((a, b) => +a - +b);
  const nearest = expiries[0];
  const low = min > 0 && qty < min;
  const sym = product.unit?.symbol ?? "";
  const margin = sell > 0 ? ((sell - buy) / sell) * 100 : null;
  const soon = (d: Date | null | undefined) => !!d && +d - Date.now() < 60 * 86400000;

  const info: [string, React.ReactNode][] = [
    [p.category, product.category?.name ?? "—"],
    [p.unit, product.unit ? `${product.unit.name} (${sym})` : "—"],
    [p.barcode, product.barcode ? <span className="font-mono" dir="ltr">{product.barcode}</span> : "—"],
    [p.purchasePrice, <span dir="ltr">{formatMoney(buy)}</span>],
    [p.sellingPrice, <span dir="ltr">{formatMoney(sell)}</span>],
    [p.margin, <span dir="ltr" className={cn(margin !== null && margin < 0 && "text-red-600")}>{margin === null ? "—" : `${margin.toFixed(1)}%`}</span>],
    [p.discount, <span dir="ltr">{product.discountRate.toString()}%</span>],
    [p.tax, <span dir="ltr">{product.taxRate.toString()}%</span>],
    [p.minQuantity, <span dir="ltr">{formatNumber(min)} {sym}</span>],
    [p.tracksBatch, product.tracksBatch ? "✓" : "—"],
    [p.tracksExpiry, product.tracksExpiry ? "✓" : "—"],
  ];

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href="/products" className="inline-flex items-center gap-1 hover:text-ink">
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            {p.title}
          </Link>
        }
        title={product.name}
        badge={
          <>
            <StatusBadge status={product.status} label={dict.status[product.status]} />
            {low && <Badge tone={qty === 0 ? "red" : "yellow"}>{qty === 0 ? p.outOfStock : p.lowStock}</Badge>}
          </>
        }
        description={
          <span className="flex items-center gap-3">
            <ProductThumb name={product.name} imageUrl={product.imageUrl} size={28} />
            <span className="font-mono" dir="ltr">{product.code}</span>
            {product.category && <span>· {product.category.name}</span>}
          </span>
        }
        actions={
          <ProductDetailActions
            product={{ id: product.id, code: product.code, name: product.name, status: product.status }}
            perms={{ edit: can(user.permissions, "products", "edit"), delete: can(user.permissions, "products", "delete") }}
          />
        }
      />

      {low && (
        <div role="status" className="mb-6 flex items-center gap-3 rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1 font-medium">{p.stockAlertToast}</span>
          <span dir="ltr" className="tabular">
            {formatNumber(qty)} / {formatNumber(min)} {sym}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[
          { icon: Boxes, label: p.onHand, value: `${formatNumber(qty)} ${sym}` },
          { icon: DollarSign, label: p.stockValue, value: formatMoney(value) },
          { icon: Warehouse, label: p.warehouses, value: formatNumber(whCount) },
          { icon: CalendarClock, label: p.nearestExpiry, value: nearest ? formatDate(nearest) : "—", warn: soon(nearest) },
        ].map((s) => (
          <div key={s.label} className="zw-card p-4 sm:p-5">
            <div className="flex items-center gap-2 text-[12.5px] font-medium text-ink-muted">
              <s.icon className={cn("h-4 w-4", s.warn ? "text-amber-500" : "text-brand-600")} />
              {s.label}
            </div>
            <div className={cn("mt-2 text-[20px] font-semibold tracking-tight tabular sm:text-[22px]", s.warn && "text-amber-700")} dir="ltr">
              {s.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={p.stockByWarehouse} />
          {product.stock.length === 0 ? (
            <EmptyState compact icon={<Boxes className="h-5 w-5" />} title={p.noStock} body={p.noStockBody} />
          ) : (
            <ul className="divide-y divide-line">
              {product.stock.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <Warehouse className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/warehouses/${s.warehouse.id}`} className="block truncate font-medium text-ink hover:text-brand-700">
                      {s.warehouse.name}
                    </Link>
                    <div className="flex flex-wrap gap-x-3 text-[12.5px] text-ink-muted">
                      <span className="font-mono" dir="ltr">{s.batch?.number ?? "—"}</span>
                      {s.batch?.expiryDate && (
                        <span className={cn(soon(s.batch.expiryDate) && "font-medium text-amber-700")}>
                          {dict.warehouses.expiry}: {formatDate(s.batch.expiryDate)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-end" dir="ltr">
                    <div className="font-semibold">
                      {formatNumber(s.quantity.toString())} <span className="text-[12px] font-normal text-ink-muted">{sym}</span>
                    </div>
                    <div className="text-[12px] text-ink-muted">{formatMoney(Number(s.quantity) * buy)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title={p.details} />
          <dl className="divide-y divide-line text-[14px]">
            {info.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 px-5 py-2.5">
                <dt className="text-ink-muted">{k}</dt>
                <dd className="text-end font-medium text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          {(product.description || product.notes) && (
            <div className="space-y-3 border-t border-line px-5 py-4 text-[14px]">
              {product.description && <p className="whitespace-pre-line text-ink-soft">{product.description}</p>}
              {product.notes && (
                <p className="whitespace-pre-line rounded-lg bg-canvas px-3 py-2 text-[13px] text-ink-muted">{product.notes}</p>
              )}
            </div>
          )}
        </Card>

        {activity.length > 0 && (
          <Card className="lg:col-span-3">
            <CardHeader title={dict.warehouses.tabActivity} />
            <ol className="divide-y divide-line">
              {activity.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-5 py-3 text-[14px]">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-canvas text-[11px] font-semibold ring-1 ring-line">
                    {initials(a.userName)}
                  </span>
                  <span className="flex-1">
                    <strong className="font-semibold">{a.userName}</strong>{" "}
                    <span className="text-ink-muted">{dict.audit[a.action as keyof typeof dict.audit] ?? a.action}</span>{" "}
                    <span className="font-mono text-[13px] text-brand-700" dir="ltr">{a.recordRef}</span>
                  </span>
                  <time className="text-[12px] text-ink-faint">
                    {formatDate(a.createdAt)} · {formatTime(a.createdAt)}
                  </time>
                </li>
              ))}
            </ol>
          </Card>
        )}
      </div>
    </>
  );
}
