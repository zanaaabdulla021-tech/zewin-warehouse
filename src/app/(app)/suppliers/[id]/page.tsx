import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileText, Mail, MapPin, Phone, ReceiptText, Undo2, User } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getDict } from "@/i18n/server";
import { formatDate, formatMoney, formatNumber } from "@/lib/utils";
import { Forbidden } from "@/components/layout/module-states";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SupplierDetailActions } from "./detail-actions";

export default async function SupplierDetailsPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!can(user.permissions, "suppliers")) return <Forbidden />;
  const dict = getDict();
  const s = dict.suppliers;

  const supplier = await prisma.supplier.findUnique({
    where: { id: params.id },
    include: {
      documents: {
        orderBy: { date: "desc" },
        take: 100,
        include: { warehouse: { select: { name: true } }, _count: { select: { items: true } } },
      },
    },
  });
  if (!supplier) notFound();

  const verified = supplier.documents.filter((d) => d.status === "VERIFIED");
  const purchased = verified.filter((d) => d.type === "PURCHASE").reduce((a, d) => a + Number(d.grandTotalBase), 0);
  const returned = verified.filter((d) => d.type === "RETURN").reduce((a, d) => a + Number(d.grandTotalBase), 0);
  const last = supplier.documents[0];

  const contact = [
    { icon: User, value: supplier.contactName },
    { icon: Phone, value: supplier.phone, ltr: true },
    { icon: Mail, value: supplier.email, ltr: true },
    { icon: MapPin, value: [supplier.address, supplier.city].filter(Boolean).join(", ") || null },
    { icon: ReceiptText, value: supplier.taxNumber ? `${s.taxNumber}: ${supplier.taxNumber}` : null },
  ].filter((c) => c.value);

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href="/suppliers" className="inline-flex items-center gap-1 hover:text-ink">
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            {s.title}
          </Link>
        }
        title={supplier.name}
        badge={<StatusBadge status={supplier.status} label={dict.status[supplier.status]} />}
        description={<span className="font-mono" dir="ltr">{supplier.code}</span>}
        actions={
          <SupplierDetailActions
            supplier={{ id: supplier.id, name: supplier.name, status: supplier.status }}
            perms={{
              edit: can(user.permissions, "suppliers", "edit"),
              delete: can(user.permissions, "suppliers", "delete"),
              purchase: can(user.permissions, "documents", "create"),
            }}
          />
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[
          { icon: ReceiptText, label: s.purchased, value: formatMoney(purchased) },
          { icon: Undo2, label: s.returned, value: formatMoney(returned) },
          { icon: FileText, label: s.docsCount, value: formatNumber(supplier.documents.length) },
          { icon: FileText, label: s.lastDocument, value: last ? formatDate(last.date) : "—" },
        ].map((k) => (
          <div key={k.label} className="zw-card p-4 sm:p-5">
            <div className="flex items-center gap-2 text-[12.5px] font-medium text-ink-muted">
              <k.icon className="h-4 w-4 text-brand-600" />
              {k.label}
            </div>
            <div className="mt-2 text-[20px] font-semibold tracking-tight tabular sm:text-[22px]" dir="ltr">
              {k.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={s.transactions} />
          {supplier.documents.length === 0 ? (
            <EmptyState compact icon={<FileText className="h-5 w-5" />} title={s.noTransactions} body={s.noTransactionsBody} />
          ) : (
            <ul className="divide-y divide-line">
              {supplier.documents.map((d) => (
                <li key={d.id}>
                  <Link href={`/documents/${d.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-canvas/60">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[13.5px] font-semibold" dir="ltr">{d.number}</span>
                        <Badge tone={d.type === "RETURN" ? "gray" : "brand"} dot={false}>
                          {dict.docType[d.type]}
                        </Badge>
                      </div>
                      <div className="truncate text-[12.5px] text-ink-muted">
                        {formatDate(d.date)} · {d.warehouse.name} · {d._count.items} {dict.documents.items.toLowerCase()}
                        {d.referenceNumber && ` · ${d.referenceNumber}`}
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="font-semibold" dir="ltr">{formatMoney(d.grandTotal, d.currency)}</div>
                      <StatusBadge status={d.status} label={dict.status[d.status]} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="h-fit">
          <CardHeader title={s.sectionContact} />
          {contact.length ? (
            <ul className="divide-y divide-line text-[14px]">
              {contact.map((c, i) => (
                <li key={i} className="flex items-start gap-3 px-5 py-3">
                  <c.icon className="mt-0.5 h-4 w-4 text-ink-faint" />
                  <span className="flex-1 text-ink-soft" dir={c.ltr ? "ltr" : undefined}>
                    {c.value}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-4 text-[13.5px] text-ink-muted">—</p>
          )}
          {supplier.notes && <p className="whitespace-pre-line border-t border-line px-5 py-4 text-[13.5px] text-ink-soft">{supplier.notes}</p>}
        </Card>
      </div>
    </>
  );
}
