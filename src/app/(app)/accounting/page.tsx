import Link from "next/link";
import { CheckCircle2, Clock, DollarSign, Hourglass, ShieldCheck, XCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getDict } from "@/i18n/server";
import { interpolate as t } from "@/i18n/config";
import { cn, formatDate, formatMoney, formatTime } from "@/lib/utils";
import { Forbidden } from "@/components/layout/module-states";
import { PageHeader } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Accounting" };

const TABS = ["pending", "verified", "rejected", "history"] as const;
type Tab = (typeof TABS)[number];

/** "3 h", "2 d" — compact waiting time */
function since(from: Date) {
  const h = Math.max(0, Math.round((Date.now() - +from) / 3600000));
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} d`;
}

export default async function AccountingPage({ searchParams }: { searchParams: { tab?: string } }) {
  const user = await getSessionUser();
  if (!can(user.permissions, "accounting")) return <Forbidden />;
  const dict = getDict();
  const a = dict.accounting;
  const tab: Tab = TABS.includes(searchParams.tab as Tab) ? (searchParams.tab as Tab) : "pending";
  const canVerify = can(user.permissions, "accounting", "verify");
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [pendingAgg, verifiedMonth, rejectedMonth, verifiedTimes] = await Promise.all([
    prisma.document.aggregate({ where: { status: "PENDING" }, _count: true, _sum: { grandTotalBase: true } }),
    prisma.verification.count({ where: { result: "VERIFIED", createdAt: { gte: monthStart } } }),
    prisma.verification.count({ where: { result: "REJECTED", createdAt: { gte: monthStart } } }),
    prisma.document.findMany({
      where: { status: "VERIFIED", verifiedAt: { gte: monthStart }, submittedAt: { not: null } },
      select: { submittedAt: true, verifiedAt: true },
    }),
  ]);
  const avgH = verifiedTimes.length
    ? Math.round(verifiedTimes.reduce((s, d) => s + (+d.verifiedAt! - +d.submittedAt!), 0) / verifiedTimes.length / 3600000)
    : null;

  const kpis = [
    { label: a.kpiPending, value: String(pendingAgg._count), icon: Clock, tone: pendingAgg._count ? "amber" : "" },
    { label: a.kpiPendingValue, value: formatMoney(pendingAgg._sum.grandTotalBase ?? 0), icon: DollarSign, tone: "" },
    { label: a.kpiVerified, value: String(verifiedMonth), icon: CheckCircle2, tone: "green" },
    { label: a.kpiRejected, value: String(rejectedMonth), icon: XCircle, tone: rejectedMonth ? "red" : "" },
    { label: a.kpiAvg, value: avgH === null ? "—" : t(a.hours, { n: avgH }), icon: Hourglass, tone: "" },
  ];

  const docInclude = {
    warehouse: { select: { name: true } },
    toWarehouse: { select: { name: true } },
    supplier: { select: { name: true } },
    createdBy: { select: { name: true } },
    verifiedBy: { select: { name: true } },
    _count: { select: { items: true } },
  } as const;

  const [pending, closed, history] = await Promise.all([
    tab === "pending"
      ? prisma.document.findMany({ where: { status: "PENDING" }, orderBy: [{ submittedAt: "asc" }, { date: "asc" }], include: docInclude })
      : Promise.resolve([]),
    tab === "verified" || tab === "rejected"
      ? prisma.document.findMany({
          where: { status: tab === "verified" ? "VERIFIED" : "REJECTED" },
          orderBy: { verifiedAt: "desc" },
          take: 200,
          include: docInclude,
        })
      : Promise.resolve([]),
    tab === "history"
      ? prisma.verification.findMany({
          orderBy: { createdAt: "desc" },
          take: 300,
          include: { user: { select: { name: true } }, document: { select: { id: true, number: true, type: true, grandTotal: true, currency: true } } },
        })
      : Promise.resolve([]),
  ]);

  const tabLabel: Record<Tab, string> = { pending: a.tabPending, verified: a.tabVerified, rejected: a.tabRejected, history: a.tabHistory };

  return (
    <>
      <PageHeader title={a.title} description={a.subtitle} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="zw-card p-4 last:col-span-2 lg:last:col-span-1">
            <div className="flex items-center gap-2 text-[12.5px] font-medium text-ink-muted">
              <k.icon
                className={cn(
                  "h-4 w-4",
                  k.tone === "amber" ? "text-amber-500" : k.tone === "green" ? "text-emerald-500" : k.tone === "red" ? "text-red-500" : "text-brand-600",
                )}
              />
              {k.label}
            </div>
            <div className="mt-2 text-[22px] font-semibold tracking-tight tabular" dir="ltr">
              {k.value}
            </div>
          </div>
        ))}
      </div>

      <nav className="zw-scroll -mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        {TABS.map((tb) => (
          <Link
            key={tb}
            href={tb === "pending" ? "/accounting" : `/accounting?tab=${tb}`}
            aria-current={tab === tb ? "page" : undefined}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-[14px] font-medium transition-colors",
              tab === tb ? "border-brand-600 text-brand-800" : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {tabLabel[tb]}
            {tb === "pending" && pendingAgg._count > 0 && (
              <span className="rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800">{pendingAgg._count}</span>
            )}
          </Link>
        ))}
      </nav>

      {/* Pending queue — oldest first */}
      {tab === "pending" &&
        (pending.length === 0 ? (
          <div className="zw-card">
            <EmptyState icon={<ShieldCheck className="h-5 w-5" />} title={a.emptyPending} body={a.emptyPendingBody} />
          </div>
        ) : (
          <ul className="space-y-3">
            {pending.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/accounting/${d.id}`}
                  className="zw-card group flex flex-col gap-3 p-4 transition-shadow hover:shadow-pop sm:flex-row sm:items-center sm:gap-5 sm:p-5"
                >
                  <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 sm:flex">
                    <Clock className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[15px] font-semibold text-ink" dir="ltr">{d.number}</span>
                      <Badge tone="brand" dot={false}>
                        {dict.docType[d.type]}
                      </Badge>
                    </div>
                    <div className="mt-1 truncate text-[13px] text-ink-muted">
                      {d.warehouse.name}
                      {d.toWarehouse && ` → ${d.toWarehouse.name}`}
                      {d.supplier && ` · ${d.supplier.name}`} · {d._count.items} {dict.documents.items.toLowerCase()} · {a.submittedBy}{" "}
                      {d.createdBy.name}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-5 sm:justify-end">
                    <div className="text-end">
                      <div className="text-[17px] font-semibold tabular" dir="ltr">{formatMoney(d.grandTotal, d.currency)}</div>
                      <div className="text-[12px] text-amber-700">{t(a.waiting, { n: since(d.submittedAt ?? d.updatedAt) })}</div>
                    </div>
                    {canVerify && (
                      <span className="rounded-field bg-brand-600 px-4 py-2 text-[13.5px] font-medium text-white group-hover:bg-brand-700">
                        {a.review}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ))}

      {/* Verified / Rejected lists */}
      {(tab === "verified" || tab === "rejected") && (
        <div className="zw-card overflow-hidden">
          {closed.length === 0 ? (
            <EmptyState title={a.emptyList} />
          ) : (
            <ul className="divide-y divide-line">
              {closed.map((d) => (
                <li key={d.id}>
                  <Link href={`/documents/${d.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-canvas/60">
                    {tab === "verified" ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                    ) : (
                      <XCircle className="h-5 w-5 shrink-0 text-red-500" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[13.5px] font-semibold" dir="ltr">{d.number}</span>
                        <span className="text-[12.5px] text-ink-muted">{dict.docType[d.type]}</span>
                      </div>
                      <div className="truncate text-[12.5px] text-ink-muted">
                        {d.warehouse.name} · {tab === "verified" ? a.verifiedBy : a.rejectedBy} {d.verifiedBy?.name ?? "—"}
                        {d.verifiedAt && ` · ${formatDate(d.verifiedAt)}`}
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="font-semibold tabular" dir="ltr">{formatMoney(d.grandTotal, d.currency)}</div>
                      {d.stockReference && <div className="font-mono text-[11.5px] text-brand-700" dir="ltr">{d.stockReference}</div>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Verification history */}
      {tab === "history" && (
        <div className="zw-card overflow-hidden">
          {history.length === 0 ? (
            <EmptyState title={a.emptyList} />
          ) : (
            <>
              <table className="hidden w-full text-[14px] md:table">
                <thead>
                  <tr className="border-b border-line bg-canvas/60 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
                    <th className="px-5 py-3 text-start">{a.when}</th>
                    <th className="px-5 py-3 text-start">{a.document}</th>
                    <th className="px-5 py-3 text-start">{a.result}</th>
                    <th className="px-5 py-3 text-start">{dict.stock.by}</th>
                    <th className="px-5 py-3 text-start">{a.reason}</th>
                    <th className="px-5 py-3 text-end">{dict.documents.total}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((v) => (
                    <tr key={v.id} className="border-b border-line last:border-0 align-top">
                      <td className="whitespace-nowrap px-5 py-3 text-[13px] text-ink-soft">
                        {formatDate(v.createdAt)}
                        <div className="text-[12px] text-ink-muted">{formatTime(v.createdAt)}</div>
                      </td>
                      <td className="px-5 py-3">
                        <Link href={`/documents/${v.document.id}`} className="font-mono text-[13px] font-medium hover:text-brand-700" dir="ltr">
                          {v.document.number}
                        </Link>
                        <div className="text-[12px] text-ink-muted">{dict.docType[v.document.type]}</div>
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={v.result} label={dict.status[v.result]} />
                      </td>
                      <td className="px-5 py-3 text-ink-soft">{v.user.name}</td>
                      <td className="max-w-xs px-5 py-3 text-[13px] text-ink-muted">{v.reason ?? v.notes ?? "—"}</td>
                      <td className="px-5 py-3 text-end" dir="ltr">{formatMoney(v.document.grandTotal, v.document.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className="divide-y divide-line md:hidden">
                {history.map((v) => (
                  <li key={v.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[13px] font-medium" dir="ltr">{v.document.number}</span>
                      <StatusBadge status={v.result} label={dict.status[v.result]} />
                    </div>
                    <div className="mt-0.5 text-[12.5px] text-ink-muted">
                      {v.user.name} · {formatDate(v.createdAt)} {formatTime(v.createdAt)}
                    </div>
                    {v.reason && <p className="mt-1 text-[12.5px] text-red-700">{v.reason}</p>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </>
  );
}
