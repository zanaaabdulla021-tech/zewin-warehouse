import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, Printer, XCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getDict } from "@/i18n/server";
import { interpolate as t } from "@/i18n/config";
import { DOC_STOCK_EFFECT, type DocType } from "@/lib/documents";
import { cn, formatDate, formatMoney, formatNumber, formatTime, getBaseCurrencyCode } from "@/lib/utils";
import { Forbidden } from "@/components/layout/module-states";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { VerificationPanel } from "./verification-panel";

export const metadata = { title: "Accounting Verification" };

export default async function VerificationPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!can(user.permissions, "accounting")) return <Forbidden />;
  const dict = getDict();
  const a = dict.accounting;
  const d = dict.documents;

  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    include: {
      warehouse: { select: { id: true, name: true, code: true } },
      toWarehouse: { select: { id: true, name: true, code: true } },
      supplier: { select: { name: true, code: true } },
      createdBy: { select: { name: true } },
      items: {
        orderBy: { position: "asc" },
        include: {
          product: { select: { id: true, name: true, code: true, unit: { select: { symbol: true } } } },
          batch: { select: { number: true, expiryDate: true } },
        },
      },
      verifications: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
    },
  });
  if (!doc) notFound();
  const money = (v: number | string | { toString(): string }) => formatMoney(v, doc.currency);

  const effect = DOC_STOCK_EFFECT[doc.type as DocType] ?? "NONE";
  const outgoing = effect === "OUT" || effect === "TRANSFER";

  // live stock check for outgoing documents
  const levels = outgoing
    ? await prisma.stockLevel.findMany({
        where: { warehouseId: doc.warehouseId, productId: { in: doc.items.map((i) => i.productId) } },
        select: { productId: true, batchId: true, quantity: true },
      })
    : [];
  const availableFor = (productId: string, batchId: string | null) =>
    Number(levels.find((l) => l.productId === productId && l.batchId === batchId)?.quantity ?? 0);
  const shortLines = outgoing ? doc.items.filter((it) => Number(it.quantity) > availableFor(it.productId, it.batchId)).length : 0;

  // queue navigation (oldest first)
  const queue = await prisma.document.findMany({
    where: { status: "PENDING" },
    orderBy: [{ submittedAt: "asc" }, { date: "asc" }],
    select: { id: true },
  });
  const pos = queue.findIndex((q) => q.id === doc.id);
  const prevId = pos > 0 ? queue[pos - 1]!.id : null;
  const nextId = pos >= 0 && pos < queue.length - 1 ? queue[pos + 1]!.id : pos === -1 ? queue[0]?.id ?? null : null;

  const info: [string, React.ReactNode][] = [
    [d.type, dict.docType[doc.type]],
    [d.date, formatDate(doc.date)],
    [d.warehouse, `${doc.warehouse.name} (${doc.warehouse.code})`],
    doc.toWarehouse ? [d.toWarehouse, `${doc.toWarehouse.name} (${doc.toWarehouse.code})`] : [d.supplier, doc.supplier?.name ?? "—"],
    [d.referenceNumber, doc.referenceNumber ?? "—"],
    [a.submittedBy, doc.createdBy.name],
    [a.submittedAt, doc.submittedAt ? `${formatDate(doc.submittedAt)} · ${formatTime(doc.submittedAt)}` : "—"],
    [d.items, String(doc.items.length)],
  ];

  const effectText = t(a.stockEffect[effect], { wh: doc.warehouse.name, to: doc.toWarehouse?.name ?? "" });

  return (
    <>
      {/* Queue bar */}
      <div className="mb-5 flex flex-wrap items-center gap-3 text-[13px]">
        <Link href="/accounting" className="inline-flex items-center gap-1 text-ink-muted hover:text-ink">
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          {a.title}
        </Link>
        <div className="ms-auto flex items-center gap-2">
          {pos >= 0 && <span className="text-ink-muted">{t(a.queuePos, { i: pos + 1, n: queue.length })}</span>}
          <Link
            href={prevId ? `/accounting/${prevId}` : "#"}
            aria-disabled={!prevId}
            className={cn(
              "inline-flex h-9 items-center gap-1 rounded-lg border border-line-strong bg-white px-3 font-medium",
              prevId ? "text-ink-soft hover:bg-canvas" : "pointer-events-none opacity-40",
            )}
          >
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            {a.prev}
          </Link>
          <Link
            href={nextId ? `/accounting/${nextId}` : "#"}
            aria-disabled={!nextId}
            className={cn(
              "inline-flex h-9 items-center gap-1 rounded-lg border border-line-strong bg-white px-3 font-medium",
              nextId ? "text-ink-soft hover:bg-canvas" : "pointer-events-none opacity-40",
            )}
          >
            {a.next}
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </Link>
        </div>
      </div>

      {/* Header */}
      <div className="zw-card mb-6 overflow-hidden">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
          <div className="flex-1">
            <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{a.title}</div>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-[28px] font-bold tracking-tight text-ink sm:text-[32px]" dir="ltr">
                {doc.number}
              </h1>
              {doc.status === "PENDING" ? (
                <Badge tone="yellow" className="text-[13px]">
                  {a.pendingVerification}
                </Badge>
              ) : (
                <StatusBadge status={doc.status} label={dict.status[doc.status]} />
              )}
              <Badge tone="brand" dot={false}>
                {dict.docType[doc.type]}
              </Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <a href={`/print/documents/${doc.id}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-field border border-line-strong bg-white px-3.5 text-[13.5px] font-medium text-ink-soft hover:bg-canvas">
              <Printer className="h-4 w-4" />
              {d.print}
            </a>
            <Link href={`/documents/${doc.id}`} className="inline-flex h-10 items-center gap-2 rounded-field border border-line-strong bg-white px-3.5 text-[13.5px] font-medium text-ink-soft hover:bg-canvas">
              <ExternalLink className="h-4 w-4" />
              {a.document}
            </Link>
          </div>
        </div>
        <div
          className={cn(
            "flex items-center gap-2 border-t px-5 py-2.5 text-[13px] sm:px-6",
            effect === "NONE" ? "border-line bg-canvas/60 text-ink-muted" : "border-brand-100 bg-brand-50/60 text-brand-800",
          )}
        >
          <ArrowRight className="h-4 w-4 shrink-0 rtl:rotate-180" />
          {effectText}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          {/* Document information */}
          <section className="zw-card">
            <h2 className="border-b border-line px-5 py-3.5 text-[15px] font-semibold">{a.docInfo}</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 p-5 lg:grid-cols-4">
              {info.map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-muted">{k}</dt>
                  <dd className="mt-1 truncate text-[14px] font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            {doc.notes && (
              <p className="mx-5 mb-5 whitespace-pre-line rounded-lg bg-canvas px-3.5 py-2.5 text-[13.5px] text-ink-soft">{doc.notes}</p>
            )}
          </section>

          {/* Stock check */}
          {outgoing && doc.status === "PENDING" && (
            <div
              role={shortLines ? "alert" : "status"}
              className={cn(
                "flex items-center gap-3 rounded-card border px-4 py-3 text-[14px]",
                shortLines ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800",
              )}
            >
              {shortLines ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
              <span>
                <strong className="font-semibold">{a.stockCheck}:</strong> {shortLines ? t(a.stockShort, { n: shortLines }) : a.stockOk}
              </span>
            </div>
          )}

          {/* Items */}
          <section className="zw-card overflow-hidden">
            <h2 className="border-b border-line px-5 py-3.5 text-[15px] font-semibold">
              {d.items} <span className="ms-1 text-[13px] font-normal text-ink-faint">{doc.items.length}</span>
            </h2>
            <div className="hidden md:block">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="border-b border-line bg-canvas/60 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
                    <th className="px-5 py-2.5 text-start">#</th>
                    <th className="px-2 py-2.5 text-start">{d.product}</th>
                    <th className="px-2 py-2.5 text-start">{d.batch}</th>
                    <th className="px-2 py-2.5 text-end">{d.qty}</th>
                    {outgoing && doc.status === "PENDING" && <th className="px-2 py-2.5 text-end">{d.available}</th>}
                    <th className="px-2 py-2.5 text-end">{d.unitPrice}</th>
                    <th className="px-2 py-2.5 text-end">{d.discount}</th>
                    <th className="px-5 py-2.5 text-end">{d.total}</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.items.map((it, i) => {
                    const avail = availableFor(it.productId, it.batchId);
                    const short = outgoing && Number(it.quantity) > avail;
                    const batch = it.batch?.number ?? it.batchNumber;
                    const exp = it.batch?.expiryDate ?? it.expiryDate;
                    return (
                      <tr key={it.id} className={cn("border-b border-line last:border-0", short && doc.status === "PENDING" && "bg-red-50/50")}>
                        <td className="px-5 py-3 text-[12px] text-ink-faint">{i + 1}</td>
                        <td className="px-2 py-3">
                          <div className="font-medium text-ink">{it.product.name}</div>
                          <div className="font-mono text-[12px] text-ink-muted" dir="ltr">{it.product.code}</div>
                        </td>
                        <td className="px-2 py-3 text-[13px]">
                          <div className="font-mono text-ink-soft" dir="ltr">{batch ?? "—"}</div>
                          {exp && <div className="text-[12px] text-ink-muted">{formatDate(exp)}</div>}
                        </td>
                        <td className="px-2 py-3 text-end font-medium" dir="ltr">
                          {formatNumber(it.quantity.toString())} <span className="text-[12px] font-normal text-ink-muted">{it.product.unit?.symbol}</span>
                        </td>
                        {outgoing && doc.status === "PENDING" && (
                          <td className={cn("px-2 py-3 text-end", short ? "font-semibold text-red-600" : "text-ink-muted")} dir="ltr">
                            {formatNumber(avail)}
                            {short && <div className="text-[11.5px] font-medium">{t(a.shortBy, { n: formatNumber(+(Number(it.quantity) - avail).toFixed(3)) })}</div>}
                          </td>
                        )}
                        <td className="px-2 py-3 text-end" dir="ltr">{money(it.unitPrice)}</td>
                        <td className="px-2 py-3 text-end text-ink-muted" dir="ltr">{Number(it.discount) ? money(it.discount) : "—"}</td>
                        <td className="px-5 py-3 text-end font-semibold" dir="ltr">{money(it.lineTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-line md:hidden">
              {doc.items.map((it, i) => {
                const short = outgoing && Number(it.quantity) > availableFor(it.productId, it.batchId);
                return (
                  <li key={it.id} className={cn("px-4 py-3", short && doc.status === "PENDING" && "bg-red-50/50")}>
                    <div className="flex items-start gap-3">
                      <span className="text-[12px] text-ink-faint">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{it.product.name}</div>
                        <div className="text-[12.5px] text-ink-muted" dir="ltr">
                          {formatNumber(it.quantity.toString())} × {money(it.unitPrice)}
                          {Number(it.discount) ? ` − ${money(it.discount)}` : ""}
                        </div>
                      </div>
                      <div className="font-semibold" dir="ltr">{money(it.lineTotal)}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Previous reviews */}
          {doc.verifications.length > 0 && (
            <section className="zw-card">
              <h2 className="border-b border-line px-5 py-3.5 text-[15px] font-semibold">{a.previous}</h2>
              <ul className="divide-y divide-line">
                {doc.verifications.map((v) => (
                  <li key={v.id} className="flex gap-3 px-5 py-3.5 text-[14px]">
                    {v.result === "VERIFIED" ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    )}
                    <div className="flex-1">
                      <div>
                        <strong className="font-semibold">{v.user.name}</strong>{" "}
                        <span className="text-ink-muted">{dict.status[v.result]}</span>
                        <span className="ms-2 text-[12px] text-ink-faint">
                          {formatDate(v.createdAt)} · {formatTime(v.createdAt)}
                        </span>
                      </div>
                      {v.reason && <p className="mt-1 text-[13px] text-red-700">{v.reason}</p>}
                      {v.notes && <p className="mt-1 text-[13px] text-ink-soft">{v.notes}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <VerificationPanel
          doc={{ id: doc.id, number: doc.number, status: doc.status }}
          totals={{
            subtotal: Number(doc.subtotal),
            discount: Number(doc.discountTotal),
            tax: Number(doc.taxTotal),
            total: Number(doc.grandTotal),
          }}
          currency={doc.currency}
          base={{ code: getBaseCurrencyCode(), rate: Number(doc.exchangeRate), total: Number(doc.grandTotalBase) }}
          canVerify={can(user.permissions, "accounting", "verify")}
          hasStockEffect={effect !== "NONE"}
          creatorName={doc.createdBy.name}
        />
      </div>
    </>
  );
}
