import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownToLine,
  CalendarClock,
  CheckCircle2,
  Clock,
  DollarSign,
  FilePlus2,
  FileText,
  Package,
  PackagePlus,
  ShieldCheck,
  Warehouse,
  Activity,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getDict } from "@/i18n/server";
import { getAppSettings } from "@/lib/settings";
import { interpolate as t } from "@/i18n/config";
import { cn, formatDate, formatMoney, formatNumber, formatTime, initials } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Greeting } from "./greeting";

export const metadata = { title: "Dashboard" };

type LowStockRow = { id: string; name: string; code: string; qty: number; min: number };

export default async function DashboardPage() {
  const user = await getSessionUser();
  const dict = getDict();
  const d = dict.dashboard;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const { expiryWarningDays } = await getAppSettings();
  const in60 = new Date(Date.now() + expiryWarningDays * 86400000);

  const [
    whTotal,
    whActive,
    productCount,
    stockValueRow,
    pendingDocs,
    pendingVerify,
    verifiedMonth,
    recentDocs,
    pendingList,
    lowStock,
    expiring,
    activity,
  ] = await Promise.all([
    prisma.warehouse.count({ where: { status: { not: "ARCHIVED" } } }),
    prisma.warehouse.count({ where: { status: "ACTIVE" } }),
    prisma.product.count({ where: { status: "ACTIVE" } }),
    prisma.$queryRaw<{ value: number }[]>`
      SELECT COALESCE(SUM(s."quantity" * p."purchasePrice"), 0)::float AS value
      FROM "StockLevel" s JOIN "Product" p ON p."id" = s."productId"`,
    prisma.document.count({ where: { status: { in: ["DRAFT", "PROCESSING"] } } }),
    prisma.document.count({ where: { status: "PENDING" } }),
    prisma.document.count({ where: { status: "VERIFIED", verifiedAt: { gte: monthStart } } }),
    prisma.document.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { warehouse: { select: { name: true } } },
    }),
    prisma.document.findMany({
      where: { status: "PENDING" },
      orderBy: { date: "asc" },
      take: 5,
      include: { warehouse: { select: { name: true } }, createdBy: { select: { name: true } } },
    }),
    prisma.$queryRaw<LowStockRow[]>`
      SELECT p."id", p."name", p."code",
             COALESCE(SUM(s."quantity"), 0)::float AS qty,
             p."minQuantity"::float AS min
      FROM "Product" p LEFT JOIN "StockLevel" s ON s."productId" = p."id"
      WHERE p."status" = 'ACTIVE' AND p."minQuantity" > 0
      GROUP BY p."id"
      HAVING COALESCE(SUM(s."quantity"), 0) < p."minQuantity"
      ORDER BY (COALESCE(SUM(s."quantity"), 0) / p."minQuantity") ASC
      LIMIT 5`,
    prisma.batch.findMany({
      where: { expiryDate: { lte: in60, gte: new Date() }, stock: { some: { quantity: { gt: 0 } } } },
      orderBy: { expiryDate: "asc" },
      take: 4,
      include: { product: { select: { name: true } } },
    }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 7 }),
  ]);

  const stockValue = stockValueRow[0]?.value ?? 0;

  const stats = [
    { label: d.totalWarehouses, value: formatNumber(whTotal), sub: t(d.activeOf, { n: whActive }), icon: Warehouse, href: "/warehouses" },
    { label: d.totalProducts, value: formatNumber(productCount), sub: t(d.belowMin, { n: lowStock.length }), icon: Package, href: lowStock.length > 0 ? "/products?filter=low" : "/products", warn: lowStock.length > 0 },
    { label: d.stockValue, value: formatMoney(stockValue), sub: d.acrossWarehouses, icon: DollarSign, href: "/stock" },
    { label: d.pendingDocuments, value: formatNumber(pendingDocs), sub: dict.status.DRAFT + " · " + dict.status.PROCESSING, icon: FileText, href: "/documents" },
    { label: d.pendingVerification, value: formatNumber(pendingVerify), sub: d.awaiting, icon: Clock, href: "/accounting", accent: "amber" as const },
    { label: d.verifiedDocuments, value: formatNumber(verifiedMonth), sub: d.thisMonth, icon: CheckCircle2, href: "/accounting", accent: "green" as const },
  ];

  const quick = [
    { label: d.qaNewDocument, icon: FilePlus2, href: "/documents/new", ok: can(user.permissions, "documents", "create") },
    { label: d.qaStockIn, icon: ArrowDownToLine, href: "/stock/new?type=STOCK_IN", ok: can(user.permissions, "stock", "create") },
    { label: d.qaAddProduct, icon: PackagePlus, href: "/products/new", ok: can(user.permissions, "products", "create") },
    { label: d.qaAddWarehouse, icon: Warehouse, href: "/warehouses?new=1", ok: can(user.permissions, "warehouses", "create") },
    { label: d.qaVerify, icon: ShieldCheck, href: "/accounting", ok: can(user.permissions, "accounting", "verify") },
  ].filter((q) => q.ok);

  return (
    <div className="space-y-6">
      {/* Greeting + quick actions */}
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end">
        <div className="flex-1">
          <h1 className="text-[24px] font-semibold tracking-tight text-ink sm:text-[28px]">
            <Greeting morning={d.morning} afternoon={d.afternoon} evening={d.evening} />, {user.name.split(" ")[0]} 👋
          </h1>
          <p className="mt-1 text-[14.5px] text-ink-muted">{d.subtitle}</p>
        </div>
        {quick.length > 0 && (
          <div className="zw-scroll -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" aria-label={d.quickActions}>
            {quick.map((q, i) => (
              <Link
                key={q.label}
                href={q.href}
                className={cn(
                  "flex h-10 shrink-0 items-center gap-2 rounded-field px-4 text-[13.5px] font-medium transition-colors",
                  i === 0
                    ? "bg-brand-600 text-white hover:bg-brand-700"
                    : "border border-line-strong bg-white text-ink-soft hover:border-ink-faint hover:text-ink",
                )}
              >
                <q.icon className="h-4 w-4" />
                {q.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="zw-card group p-4 transition-shadow hover:shadow-pop sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-medium text-ink-muted">{s.label}</span>
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg",
                  s.accent === "amber" ? "bg-amber-50 text-amber-600" : s.accent === "green" ? "bg-emerald-50 text-emerald-600" : "bg-brand-50 text-brand-700",
                )}
              >
                <s.icon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 truncate text-[22px] font-semibold tracking-tight text-ink sm:text-[26px] tabular" dir="ltr">
              {s.value}
            </div>
            <div className={cn("mt-1 truncate text-[12.5px]", s.warn ? "font-medium text-amber-700" : "text-ink-muted")}>{s.sub}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Recent documents */}
        <Card className="xl:col-span-2">
          <CardHeader title={d.recentDocuments} href="/documents" hrefLabel={dict.common.viewAll} />
          {recentDocs.length === 0 ? (
            <EmptyState compact icon={<FileText className="h-5 w-5" />} title={d.noPending} />
          ) : (
            <>
              <table className="hidden w-full text-[14px] md:table">
                <thead>
                  <tr className="border-b border-line text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
                    <th className="px-5 py-2.5 text-start">{d.docNo}</th>
                    <th className="px-5 py-2.5 text-start">{d.type}</th>
                    <th className="px-5 py-2.5 text-start">{d.warehouse}</th>
                    <th className="px-5 py-2.5 text-start">{d.date}</th>
                    <th className="px-5 py-2.5 text-end">{d.total}</th>
                    <th className="px-5 py-2.5 text-start">{dict.common.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDocs.map((doc) => (
                    <tr key={doc.id} className="border-b border-line last:border-0">
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-[13px] font-medium text-ink" dir="ltr">
                        <Link href={`/documents/${doc.id}`} className="hover:text-brand-700">
                          {doc.number}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-ink-soft">{dict.docType[doc.type]}</td>
                      <td className="px-5 py-3 text-ink-soft">{doc.warehouse.name}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-ink-muted">{formatDate(doc.date)}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-end font-medium" dir="ltr">{formatMoney(doc.grandTotal, doc.currency)}</td>
                      <td className="px-5 py-3">
                        <StatusBadge status={doc.status} label={dict.status[doc.status]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className="divide-y divide-line md:hidden">
                {recentDocs.map((doc) => (
                  <li key={doc.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[13px] font-medium" dir="ltr">{doc.number}</div>
                      <div className="truncate text-[12.5px] text-ink-muted">
                        {dict.docType[doc.type]} · {doc.warehouse.name}
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="text-[13.5px] font-medium" dir="ltr">{formatMoney(doc.grandTotal, doc.currency)}</div>
                      <StatusBadge status={doc.status} label={dict.status[doc.status]} />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        {/* Pending verification */}
        <Card>
          <CardHeader title={d.pendingVerification} href="/accounting" hrefLabel={dict.common.viewAll} />
          {pendingList.length === 0 ? (
            <EmptyState compact icon={<ShieldCheck className="h-5 w-5" />} title={d.noPending} body={d.noPendingBody} />
          ) : (
            <ul className="divide-y divide-line">
              {pendingList.map((doc) => (
                <li key={doc.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <Clock className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/accounting/${doc.id}`} className="block font-mono text-[13px] font-medium text-ink hover:text-brand-700" dir="ltr">
                      {doc.number}
                    </Link>
                    <div className="truncate text-[12.5px] text-ink-muted">
                      {doc.warehouse.name} · {doc.createdBy.name}
                    </div>
                  </div>
                  <div className="text-[13.5px] font-medium" dir="ltr">{formatMoney(doc.grandTotal, doc.currency)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Stock alerts */}
        <Card>
          <CardHeader title={d.stockAlerts} href="/stock" hrefLabel={dict.common.viewAll} />
          {lowStock.length === 0 && expiring.length === 0 ? (
            <EmptyState compact icon={<CheckCircle2 className="h-5 w-5" />} title={d.noAlerts} body={d.noAlertsBody} />
          ) : (
            <ul className="divide-y divide-line">
              {lowStock.map((p) => {
                const pct = Math.max(4, Math.min(100, (p.qty / p.min) * 100));
                return (
                  <li key={p.id} className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                      <span className="flex-1 truncate text-[14px] font-medium text-ink">{p.name}</span>
                      <span className="text-[12px] font-medium text-red-600">{d.lowStock}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-red-400" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-1 text-[12px] text-ink-muted">
                      {t(d.onHand, { qty: formatNumber(p.qty), min: formatNumber(p.min) })}
                    </div>
                  </li>
                );
              })}
              {expiring.map((b) => (
                <li key={b.id} className="flex items-center gap-2 px-5 py-3">
                  <CalendarClock className="h-4 w-4 shrink-0 text-amber-500" />
                  <span className="min-w-0 flex-1 truncate text-[14px] text-ink">
                    {b.product.name} <span className="font-mono text-[12px] text-ink-muted" dir="ltr">{b.number}</span>
                  </span>
                  <span className="text-[12px] font-medium text-amber-700">
                    {t(d.expiringSoon, { date: formatDate(b.expiryDate!) })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Recent activity */}
        <Card className="xl:col-span-2">
          <CardHeader title={d.recentActivity} />
          {activity.length === 0 ? (
            <EmptyState compact icon={<Activity className="h-5 w-5" />} title={dict.common.noResults} />
          ) : (
            <ol className="px-5 py-2">
              {activity.map((a, i) => (
                <li key={a.id} className="relative flex gap-3 py-2.5">
                  {i < activity.length - 1 && <span className="absolute start-4 top-11 h-[calc(100%-28px)] w-px bg-line" aria-hidden />}
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-canvas text-[11px] font-semibold text-ink-soft ring-1 ring-line">
                    {initials(a.userName)}
                  </span>
                  <div className="min-w-0 flex-1 pt-1 text-[14px]">
                    <span className="font-semibold text-ink">{a.userName}</span>{" "}
                    <span className="text-ink-muted">{dict.audit[a.action as keyof typeof dict.audit] ?? a.action}</span>{" "}
                    <span className="text-ink-soft">{dict.nav[a.module as keyof typeof dict.nav] ?? a.module}</span>{" "}
                    {a.recordRef && <span className="font-mono text-[13px] font-medium text-brand-700" dir="ltr">{a.recordRef}</span>}
                  </div>
                  <time className="shrink-0 pt-1 text-[12px] text-ink-faint" dateTime={a.createdAt.toISOString()}>
                    {formatDate(a.createdAt)} · {formatTime(a.createdAt)}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}
