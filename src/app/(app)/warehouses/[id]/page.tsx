import Link from "next/link";
import { notFound } from "next/navigation";
import { Boxes, ChevronLeft, DollarSign, MapPin, Package, Pencil, Phone, User, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getDict } from "@/i18n/server";
import { cn, formatDate, formatMoney, formatNumber, formatTime, initials } from "@/lib/utils";
import { Forbidden } from "@/components/layout/module-states";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { warehouseStockSummary } from "../queries";
import { DetailActions } from "./detail-actions";

const TABS = ["overview", "stock", "employees", "activity"] as const;
type Tab = (typeof TABS)[number];

export default async function WarehouseDetailsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  const user = await getSessionUser();
  if (!can(user.permissions, "warehouses")) return <Forbidden />;
  const dict = getDict();
  const w = dict.warehouses;
  const tab: Tab = TABS.includes(searchParams.tab as Tab) ? (searchParams.tab as Tab) : "overview";

  const wh = await prisma.warehouse.findUnique({
    where: { id: params.id },
    include: {
      manager: { select: { name: true, email: true, phone: true } },
      employees: { include: { user: { select: { name: true, email: true, role: { select: { name: true } } } } } },
    },
  });
  if (!wh) notFound();

  const [summary, stock, activity] = await Promise.all([
    warehouseStockSummary().then((m) => m.get(wh.id)),
    tab === "stock" || tab === "overview"
      ? prisma.stockLevel.findMany({
          where: { warehouseId: wh.id, quantity: { gt: 0 } },
          include: {
            product: { select: { name: true, code: true, purchasePrice: true, unit: { select: { symbol: true } } } },
            batch: { select: { number: true, expiryDate: true } },
          },
          orderBy: { product: { name: "asc" } },
          take: tab === "overview" ? 5 : 200,
        })
      : Promise.resolve([]),
    prisma.auditLog.findMany({
      where: { module: "warehouses", recordId: wh.id },
      orderBy: { createdAt: "desc" },
      take: tab === "activity" ? 50 : 5,
    }),
  ]);

  const tabLabel: Record<Tab, string> = {
    overview: w.tabOverview,
    stock: w.tabStock,
    employees: w.tabEmployees,
    activity: w.tabActivity,
  };

  const stats = [
    { label: w.stockItems, value: formatNumber(summary?.products ?? 0), icon: Package },
    { label: w.units, value: formatNumber(summary?.units ?? 0), icon: Boxes },
    { label: w.colValue, value: formatMoney(summary?.value ?? 0), icon: DollarSign },
    { label: w.staff, value: formatNumber(wh.employees.length), icon: Users },
  ];

  const soon = (d: Date | null) => !!d && d.getTime() - Date.now() < 60 * 86400000;

  const stockTable = (
    <>
      <table className="hidden w-full text-[14px] md:table">
        <thead>
          <tr className="border-b border-line text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
            <th className="px-5 py-2.5 text-start">{w.product}</th>
            <th className="px-5 py-2.5 text-start">{w.batch}</th>
            <th className="px-5 py-2.5 text-start">{w.expiry}</th>
            <th className="px-5 py-2.5 text-end">{w.quantity}</th>
            <th className="px-5 py-2.5 text-end">{w.colValue}</th>
          </tr>
        </thead>
        <tbody>
          {stock.map((s) => (
            <tr key={s.id} className="border-b border-line last:border-0">
              <td className="px-5 py-3">
                <div className="font-medium text-ink">{s.product.name}</div>
                <div className="font-mono text-[12px] text-ink-muted" dir="ltr">{s.product.code}</div>
              </td>
              <td className="px-5 py-3 font-mono text-[13px] text-ink-soft" dir="ltr">{s.batch?.number ?? "—"}</td>
              <td className="px-5 py-3">
                {s.batch?.expiryDate ? (
                  <span className={cn("text-[13px]", soon(s.batch.expiryDate) ? "font-medium text-amber-700" : "text-ink-soft")}>
                    {formatDate(s.batch.expiryDate)}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-5 py-3 text-end font-medium" dir="ltr">
                {formatNumber(s.quantity.toString())} <span className="text-[12px] text-ink-muted">{s.product.unit?.symbol}</span>
              </td>
              <td className="px-5 py-3 text-end" dir="ltr">
                {formatMoney(Number(s.quantity) * Number(s.product.purchasePrice))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y divide-line md:hidden">
        {stock.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{s.product.name}</div>
              <div className="text-[12.5px] text-ink-muted" dir="ltr">
                {s.batch?.number ?? "—"} {s.batch?.expiryDate && `· ${formatDate(s.batch.expiryDate)}`}
              </div>
            </div>
            <div className="text-[14px] font-semibold" dir="ltr">
              {formatNumber(s.quantity.toString())} {s.product.unit?.symbol}
            </div>
          </li>
        ))}
      </ul>
    </>
  );

  const activityList = (
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
  );

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href="/warehouses" className="inline-flex items-center gap-1 hover:text-ink">
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            {w.title}
          </Link>
        }
        title={wh.name}
        badge={
          <>
            <StatusBadge status={wh.status} label={dict.status[wh.status]} />
            <Badge tone="brand" dot={false}>
              {w.types[wh.type]}
            </Badge>
          </>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-mono" dir="ltr">{wh.code}</span>
            {wh.city && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {wh.city}
              </span>
            )}
          </span>
        }
        actions={
          <DetailActions
            warehouse={{ id: wh.id, code: wh.code, name: wh.name, status: wh.status }}
            perms={{ edit: can(user.permissions, "warehouses", "edit"), delete: can(user.permissions, "warehouses", "delete") }}
            editIcon={<Pencil className="h-4 w-4" />}
          />
        }
      />

      {/* Tabs */}
      <nav className="zw-scroll -mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0" aria-label="Tabs">
        {TABS.map((tb) => (
          <Link
            key={tb}
            href={tb === "overview" ? `/warehouses/${wh.id}` : `/warehouses/${wh.id}?tab=${tb}`}
            aria-current={tab === tb ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-4 py-3 text-[14px] font-medium transition-colors",
              tab === tb ? "border-brand-600 text-brand-800" : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {tabLabel[tb]}
          </Link>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="zw-card p-4 sm:p-5">
                <div className="flex items-center gap-2 text-[12.5px] font-medium text-ink-muted">
                  <s.icon className="h-4 w-4 text-brand-600" />
                  {s.label}
                </div>
                <div className="mt-2 text-[22px] font-semibold tracking-tight tabular" dir="ltr">
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title={w.tabStock} href={`/warehouses/${wh.id}?tab=stock`} hrefLabel={dict.common.viewAll} />
              {stock.length ? stockTable : <EmptyState compact icon={<Boxes className="h-5 w-5" />} title={w.noStock} body={w.noStockBody} />}
            </Card>

            <Card>
              <CardHeader title={w.detailsTitle} />
              <dl className="divide-y divide-line text-[14px]">
                {[
                  { icon: User, label: w.manager, value: wh.manager?.name ?? w.unassigned },
                  { icon: Phone, label: w.phone, value: wh.phone ?? "—", ltr: true },
                  { icon: MapPin, label: w.address, value: [wh.address, wh.city].filter(Boolean).join(", ") || "—" },
                  { icon: Boxes, label: w.capacity, value: wh.capacity ? formatNumber(wh.capacity) : "—" },
                ].map((r) => (
                  <div key={r.label} className="flex items-start gap-3 px-5 py-3">
                    <r.icon className="mt-0.5 h-4 w-4 text-ink-faint" />
                    <dt className="w-24 shrink-0 text-ink-muted">{r.label}</dt>
                    <dd className="flex-1 font-medium text-ink" dir={r.ltr ? "ltr" : undefined}>
                      {r.value}
                    </dd>
                  </div>
                ))}
              </dl>
              {wh.notes && (
                <div className="border-t border-line px-5 py-4">
                  <div className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">{dict.common.notes}</div>
                  <p className="whitespace-pre-line text-[14px] text-ink-soft">{wh.notes}</p>
                </div>
              )}
            </Card>
          </div>

          {activity.length > 0 && (
            <Card>
              <CardHeader title={w.tabActivity} href={`/warehouses/${wh.id}?tab=activity`} hrefLabel={dict.common.viewAll} />
              {activityList}
            </Card>
          )}
        </div>
      )}

      {tab === "stock" && (
        <Card>{stock.length ? stockTable : <EmptyState icon={<Boxes className="h-5 w-5" />} title={w.noStock} body={w.noStockBody} />}</Card>
      )}

      {tab === "employees" && (
        <Card>
          {wh.employees.length === 0 ? (
            <EmptyState icon={<Users className="h-5 w-5" />} title={w.noEmployees} body={w.noEmployeesBody} />
          ) : (
            <ul className="grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0">
              {wh.employees.map((e) => (
                <li key={e.userId} className="flex items-center gap-3 border-line px-5 py-4 sm:border-b">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-[13px] font-semibold text-brand-800">
                    {initials(e.user.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{e.user.name}</div>
                    <div className="truncate text-[12.5px] text-ink-muted">
                      {e.position ?? e.user.role.name} · <span dir="ltr">{e.user.email}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "activity" && (
        <Card>{activity.length ? activityList : <EmptyState title={dict.common.noResults} />}</Card>
      )}
    </>
  );
}
