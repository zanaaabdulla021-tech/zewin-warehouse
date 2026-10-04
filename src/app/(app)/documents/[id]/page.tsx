import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, ChevronLeft, CircleDot, FilePlus2, PackageCheck, Send, XCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getDict } from "@/i18n/server";
import { DOC_STOCK_EFFECT, isEditable, type DocType } from "@/lib/documents";
import { cn, formatDate, formatMoney, formatNumber, formatTime, getBaseCurrencyCode } from "@/lib/utils";
import { interpolate as t } from "@/i18n/config";
import { Forbidden } from "@/components/layout/module-states";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { DocumentDetailActions } from "./detail-actions";

export default async function DocumentDetailsPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!can(user.permissions, "documents")) return <Forbidden />;
  const dict = getDict();
  const d = dict.documents;

  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    include: {
      warehouse: { select: { id: true, name: true, code: true } },
      toWarehouse: { select: { id: true, name: true, code: true } },
      supplier: { select: { name: true, code: true } },
      createdBy: { select: { name: true } },
      verifiedBy: { select: { name: true } },
      items: {
        orderBy: { position: "asc" },
        include: {
          product: { select: { id: true, name: true, code: true, unit: { select: { symbol: true } } } },
          batch: { select: { number: true, expiryDate: true } },
        },
      },
      verifications: { orderBy: { createdAt: "asc" }, include: { user: { select: { name: true } } } },
    },
  });
  if (!doc) notFound();
  const money = (v: number | string | { toString(): string }) => formatMoney(v, doc.currency);

  const editable = isEditable(doc.status);
  const lastRejection = [...doc.verifications].reverse().find((v) => v.result === "REJECTED");
  const effect = DOC_STOCK_EFFECT[doc.type as DocType] ?? "NONE";

  const info: [string, React.ReactNode][] = [
    [d.date, formatDate(doc.date)],
    [
      d.warehouse,
      <Link key="w" href={`/warehouses/${doc.warehouse.id}`} className="hover:text-brand-700">
        {doc.warehouse.name}
      </Link>,
    ],
    doc.toWarehouse
      ? [
          d.toWarehouse,
          <Link key="tw" href={`/warehouses/${doc.toWarehouse.id}`} className="hover:text-brand-700">
            {doc.toWarehouse.name}
          </Link>,
        ]
      : [d.supplier, doc.supplier?.name ?? "—"],
    [d.referenceNumber, doc.referenceNumber ?? "—"],
    [d.createdBy, doc.createdBy.name],
  ];

  type Ev = { at: Date; icon: React.ElementType; tone: string; title: string; who?: string; note?: string | null };
  const events: Ev[] = [{ at: doc.createdAt, icon: FilePlus2, tone: "text-ink-muted", title: d.tlCreated, who: doc.createdBy.name }];
  if (doc.submittedAt) events.push({ at: doc.submittedAt, icon: Send, tone: "text-amber-600", title: d.tlSubmitted });
  for (const v of doc.verifications) {
    events.push({
      at: v.createdAt,
      icon: v.result === "VERIFIED" ? CheckCircle2 : XCircle,
      tone: v.result === "VERIFIED" ? "text-emerald-600" : "text-red-600",
      title: v.result === "VERIFIED" ? d.tlVerified : d.tlRejected,
      who: v.user.name,
      note: v.reason ?? v.notes,
    });
  }
  if (doc.stockReference) events.push({ at: doc.verifiedAt ?? doc.updatedAt, icon: PackageCheck, tone: "text-brand-600", title: `${d.tlStock} · ${doc.stockReference}` });
  events.sort((a, b) => +a.at - +b.at);

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href="/documents" className="inline-flex items-center gap-1 hover:text-ink">
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            {d.title}
          </Link>
        }
        title={doc.number}
        badge={
          <>
            <StatusBadge status={doc.status} label={dict.status[doc.status]} />
            <Badge tone="brand" dot={false}>
              {dict.docType[doc.type]}
            </Badge>
          </>
        }
        description={d.typeDesc[doc.type as DocType]}
        actions={
          <DocumentDetailActions
            doc={{ id: doc.id, number: doc.number, status: doc.status, editable }}
            perms={{
              edit: can(user.permissions, "documents", "edit") || (doc.createdById === user.id && can(user.permissions, "documents", "create")),
              delete: can(user.permissions, "documents", "delete") || (doc.createdById === user.id && can(user.permissions, "documents", "create")),
              submit: can(user.permissions, "documents", "edit") || (doc.createdById === user.id && can(user.permissions, "documents", "create")),
            }}
          />
        }
      />

      {doc.status === "REJECTED" && lastRejection && (
        <div role="alert" className="mb-6 flex gap-3 rounded-card border border-red-200 bg-red-50 px-4 py-3.5 text-[14px] text-red-800">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold">
              {d.rejectionReason} — {lastRejection.user.name}
            </div>
            <p className="mt-0.5 whitespace-pre-line">{lastRejection.reason}</p>
          </div>
        </div>
      )}
      {doc.status === "PENDING" && (
        <div role="status" className="mb-6 flex flex-wrap items-center gap-3 rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-800">
          <CircleDot className="h-4 w-4 shrink-0" />
          <span className="flex-1">{d.submitted}</span>
          {can(user.permissions, "accounting", "verify") && (
            <Link
              href={`/accounting/${doc.id}`}
              className="rounded-lg bg-amber-600 px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-amber-700"
            >
              {dict.accounting.review}
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Info */}
          <Card>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 p-5 sm:grid-cols-3">
              {info.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[12px] font-medium uppercase tracking-wide text-ink-muted">{k}</dt>
                  <dd className="mt-1 text-[14px] font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader title={`${d.items} (${doc.items.length})`} />
            <div className="hidden md:block">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="border-b border-line text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
                    <th className="px-5 py-2.5 text-start">{d.product}</th>
                    <th className="px-3 py-2.5 text-start">{d.batch}</th>
                    <th className="px-3 py-2.5 text-end">{d.qty}</th>
                    <th className="px-3 py-2.5 text-end">{d.unitPrice}</th>
                    <th className="px-3 py-2.5 text-end">{d.discount}</th>
                    <th className="px-5 py-2.5 text-end">{d.total}</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.items.map((it) => {
                    const batch = it.batch?.number ?? it.batchNumber;
                    const exp = it.batch?.expiryDate ?? it.expiryDate;
                    return (
                      <tr key={it.id} className="border-b border-line last:border-0">
                        <td className="px-5 py-3">
                          <Link href={`/products/${it.product.id}`} className="font-medium text-ink hover:text-brand-700">
                            {it.product.name}
                          </Link>
                          <div className="font-mono text-[12px] text-ink-muted" dir="ltr">{it.product.code}</div>
                        </td>
                        <td className="px-3 py-3 text-[13px] text-ink-soft">
                          <div className="font-mono" dir="ltr">{batch ?? "—"}</div>
                          {exp && <div className="text-[12px] text-ink-muted">{formatDate(exp)}</div>}
                        </td>
                        <td className="px-3 py-3 text-end" dir="ltr">
                          {formatNumber(it.quantity.toString())} <span className="text-[12px] text-ink-muted">{it.product.unit?.symbol}</span>
                        </td>
                        <td className="px-3 py-3 text-end" dir="ltr">{money(it.unitPrice)}</td>
                        <td className="px-3 py-3 text-end text-ink-muted" dir="ltr">{Number(it.discount) ? money(it.discount) : "—"}</td>
                        <td className="px-5 py-3 text-end font-semibold" dir="ltr">{money(it.lineTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-line md:hidden">
              {doc.items.map((it) => (
                <li key={it.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{it.product.name}</div>
                    <div className="text-[12.5px] text-ink-muted" dir="ltr">
                      {formatNumber(it.quantity.toString())} × {money(it.unitPrice)} {it.batch?.number ?? it.batchNumber ? `· ${it.batch?.number ?? it.batchNumber}` : ""}
                    </div>
                  </div>
                  <div className="font-semibold" dir="ltr">{money(it.lineTotal)}</div>
                </li>
              ))}
            </ul>
            <dl className="ms-auto max-w-sm space-y-2 border-t border-line p-5 text-[14px]">
              {[
                [d.subtotal, Number(doc.subtotal)],
                [d.discount, Number(doc.discountTotal) ? -Number(doc.discountTotal) : 0],
                [d.tax, Number(doc.taxTotal)],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between">
                  <dt className="text-ink-muted">{k}</dt>
                  <dd dir="ltr">{money(v as number)}</dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between border-t border-line-strong pt-2.5">
                <dt className="font-semibold">{d.grandTotal}</dt>
                <dd className="text-[20px] font-bold" dir="ltr">{money(doc.grandTotal)}</dd>
              </div>
              {doc.currency !== getBaseCurrencyCode() && (
                <div className="flex justify-between text-[12.5px] text-ink-muted">
                  <dt>
                    {t(dict.currency.inBase, { base: getBaseCurrencyCode() })} ·{" "}
                    <span dir="ltr">{t(dict.currency.rateLine, { code: doc.currency, rate: Number(doc.exchangeRate), base: getBaseCurrencyCode() })}</span>
                  </dt>
                  <dd dir="ltr">{formatMoney(doc.grandTotalBase)}</dd>
                </div>
              )}
            </dl>
          </Card>

          {doc.notes && (
            <Card>
              <CardHeader title={d.sectionNotes} />
              <p className="whitespace-pre-line px-5 py-4 text-[14px] text-ink-soft">{doc.notes}</p>
            </Card>
          )}
        </div>

        {/* Timeline */}
        <Card className="h-fit">
          <CardHeader title={d.timeline} />
          <ol className="px-5 py-4">
            {events.map((e, i) => (
              <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
                {i < events.length - 1 && <span className="absolute start-[9px] top-6 h-[calc(100%-20px)] w-px bg-line" aria-hidden />}
                <e.icon className={cn("relative mt-0.5 h-[18px] w-[18px] shrink-0 bg-white", e.tone)} />
                <div className="min-w-0 flex-1 text-[13.5px]">
                  <div className="font-medium text-ink">{e.title}</div>
                  <div className="text-[12px] text-ink-muted">
                    {formatDate(e.at)} · {formatTime(e.at)}
                    {e.who && ` · ${e.who}`}
                  </div>
                  {e.note && <p className="mt-1 rounded-lg bg-canvas px-2.5 py-1.5 text-[12.5px] text-ink-soft">{e.note}</p>}
                </div>
              </li>
            ))}
          </ol>
          <div className="flex items-center gap-2 border-t border-line px-5 py-3 text-[12.5px] text-ink-muted">
            <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
            {effect === "NONE" ? d.noStockEffect : d.stockNote}
          </div>
        </Card>
      </div>
    </>
  );
}
