import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getDict } from "@/i18n/server";
import { formatDate, formatMoney, formatNumber, getBaseCurrencyCode } from "@/lib/utils";
import { PrintToolbar } from "../../print-toolbar";

export const metadata = { title: "Print document" };

/**
 * A4 printable document. Deliberately different from the app UI:
 * black-on-white, hairline rules, serif-free compact type, signature blocks.
 */
export default async function PrintDocumentPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  const dict = getDict();
  const d = dict.documents;
  if (!can(user.permissions, "documents")) return <p className="p-10 text-center">{dict.common.forbidden}</p>;

  const [doc, company] = await Promise.all([
    prisma.document.findUnique({
      where: { id: params.id },
      include: {
        warehouse: { select: { name: true, code: true, address: true } },
        toWarehouse: { select: { name: true, code: true } },
        supplier: { select: { name: true, code: true, phone: true } },
        createdBy: { select: { name: true } },
        verifiedBy: { select: { name: true } },
        items: {
          orderBy: { position: "asc" },
          include: {
            product: { select: { name: true, code: true, unit: { select: { symbol: true } } } },
            batch: { select: { number: true, expiryDate: true } },
          },
        },
      },
    }),
    prisma.company.findFirst(),
  ]);
  if (!doc) notFound();
  const money = (v: number | string | { toString(): string }) => formatMoney(v, doc.currency);

  const meta: [string, string][] = [
    [d.number, doc.number],
    [d.date, formatDate(doc.date)],
    [d.type, dict.docType[doc.type]],
    [dict.common.status, dict.status[doc.status]],
    [d.warehouse, `${doc.warehouse.name} (${doc.warehouse.code})`],
    doc.toWarehouse ? [d.toWarehouse, `${doc.toWarehouse.name} (${doc.toWarehouse.code})`] : [d.supplier, doc.supplier?.name ?? "—"],
    [d.referenceNumber, doc.referenceNumber ?? "—"],
    [d.createdBy, doc.createdBy.name],
  ];

  return (
    <>
      <style>{`
        @page { size: A4; margin: 12mm 12mm 14mm; }
        @media print { html, body { background: #fff !important; } .sheet { box-shadow: none !important; margin: 0 !important; width: auto !important; min-height: 0 !important; padding: 0 !important; } }
      `}</style>
      <PrintToolbar back={`/documents/${doc.id}`} label={d.print} backLabel={dict.common.back} />

      <article className="sheet mx-auto flex min-h-[297mm] w-[210mm] max-w-full flex-col bg-white px-[14mm] py-[12mm] text-[11.5px] leading-snug text-black shadow-xl">
        {/* Header */}
        <header className="flex items-start justify-between border-b-2 border-black pb-4">
          <div>
            <div className="text-[26px] font-extrabold leading-none tracking-[0.18em]" dir="ltr">ZEWIN</div>
            <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-600">{dict.app.tagline}</div>
          </div>
          <div className="text-end text-[10.5px] text-neutral-700">
            <div className="text-[12px] font-semibold text-black">{company?.name ?? "Zewin Group"}</div>
            {company?.address && <div>{company.address}</div>}
            {company?.phone && <div dir="ltr">{company.phone}</div>}
            {company?.taxNumber && <div dir="ltr">TIN {company.taxNumber}</div>}
          </div>
        </header>

        {/* Title */}
        <div className="mt-5 flex items-end justify-between">
          <h1 className="text-[18px] font-bold uppercase tracking-wide">{dict.docType[doc.type]}</h1>
          <div className="font-mono text-[15px] font-bold" dir="ltr">{doc.number}</div>
        </div>

        {/* Meta */}
        <dl className="mt-3 grid grid-cols-4 border border-black">
          {meta.map(([k, v], i) => (
            <div key={k} className={`px-2.5 py-1.5 ${i % 4 !== 3 ? "border-e border-black" : ""} ${i < 4 ? "border-b border-black" : ""}`}>
              <dt className="text-[9px] font-semibold uppercase tracking-wider text-neutral-600">{k}</dt>
              <dd className="mt-0.5 font-medium">{v}</dd>
            </div>
          ))}
        </dl>

        {/* Items */}
        <table className="mt-5 w-full border-collapse">
          <thead>
            <tr className="border-y-2 border-black text-[9.5px] uppercase tracking-wider">
              <th className="w-6 py-1.5 text-start">#</th>
              <th className="py-1.5 text-start">{d.product}</th>
              <th className="py-1.5 text-start">{d.batch}</th>
              <th className="py-1.5 text-start">{d.expiry}</th>
              <th className="py-1.5 text-end">{d.qty}</th>
              <th className="py-1.5 text-end">{d.unitPrice}</th>
              <th className="py-1.5 text-end">{d.discount}</th>
              <th className="py-1.5 text-end">{d.total}</th>
            </tr>
          </thead>
          <tbody>
            {doc.items.map((it, i) => (
              <tr key={it.id} className="border-b border-neutral-300 align-top" style={{ breakInside: "avoid" }}>
                <td className="py-1.5 text-neutral-500">{i + 1}</td>
                <td className="py-1.5 pe-2">
                  <div className="font-medium">{it.product.name}</div>
                  <div className="font-mono text-[9.5px] text-neutral-500" dir="ltr">{it.product.code}</div>
                </td>
                <td className="py-1.5 font-mono text-[10.5px]" dir="ltr">{it.batch?.number ?? it.batchNumber ?? "—"}</td>
                <td className="py-1.5">{(it.batch?.expiryDate ?? it.expiryDate) ? formatDate((it.batch?.expiryDate ?? it.expiryDate)!) : "—"}</td>
                <td className="py-1.5 text-end" dir="ltr">
                  {formatNumber(it.quantity.toString())} {it.product.unit?.symbol}
                </td>
                <td className="py-1.5 text-end" dir="ltr">{money(it.unitPrice)}</td>
                <td className="py-1.5 text-end" dir="ltr">{Number(it.discount) ? money(it.discount) : "—"}</td>
                <td className="py-1.5 text-end font-semibold" dir="ltr">{money(it.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Summary + notes */}
        <div className="mt-4 flex gap-6" style={{ breakInside: "avoid" }}>
          <div className="flex-1">
            {doc.notes && (
              <>
                <div className="text-[9px] font-semibold uppercase tracking-wider text-neutral-600">{dict.common.notes}</div>
                <p className="mt-1 whitespace-pre-line">{doc.notes}</p>
              </>
            )}
          </div>
          <dl className="w-[70mm]">
            {[
              [d.subtotal, Number(doc.subtotal)],
              [d.discount, Number(doc.discountTotal) ? -Number(doc.discountTotal) : 0],
              [d.tax, Number(doc.taxTotal)],
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between border-b border-neutral-300 py-1">
                <dt>{k}</dt>
                <dd dir="ltr">{money(v as number)}</dd>
              </div>
            ))}
            <div className="mt-1 flex justify-between border-y-2 border-black py-1.5 text-[13px] font-bold">
              <dt>{d.grandTotal}</dt>
              <dd dir="ltr">{money(doc.grandTotal)}</dd>
            </div>
            {doc.currency !== getBaseCurrencyCode() && (
              <div className="flex justify-between py-1 text-[10px] text-neutral-600">
                <dt dir="ltr">
                  1 {doc.currency} = {Number(doc.exchangeRate)} {getBaseCurrencyCode()}
                </dt>
                <dd dir="ltr">{formatMoney(doc.grandTotalBase)}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Signatures */}
        <div className="mt-auto grid grid-cols-3 gap-6 pt-14" style={{ breakInside: "avoid" }}>
          {[
            [d.preparedBy, doc.createdBy.name],
            [d.checkedBy, doc.verifiedBy?.name ?? ""],
            [d.approvedBy, ""],
          ].map(([role, name]) => (
            <div key={role}>
              <div className="text-[9px] font-semibold uppercase tracking-wider text-neutral-600">{role}</div>
              <div className="mt-1 h-5 font-medium">{name}</div>
              <div className="mt-8 border-t border-black pt-1 text-[9px] uppercase tracking-wider text-neutral-500">{d.signature}</div>
            </div>
          ))}
        </div>

        <footer className="mt-6 flex justify-between border-t border-neutral-300 pt-2 text-[9px] text-neutral-500">
          <span>{d.printFooter}</span>
          <span dir="ltr">
            {doc.number} · {formatDate(new Date())}
          </span>
        </footer>
      </article>
    </>
  );
}
