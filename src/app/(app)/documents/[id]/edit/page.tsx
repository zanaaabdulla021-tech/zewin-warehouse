import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getDict } from "@/i18n/server";
import { canChangeDocument, isEditable, type DocType } from "@/lib/documents";
import { Forbidden } from "@/components/layout/module-states";
import { PageHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { DocumentForm } from "../../document-form";
import { documentLookups, todayIso } from "../../queries";

export const metadata = { title: "Edit document" };

export default async function EditDocumentPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!can(user.permissions, "documents")) return <Forbidden />;
  const dict = getDict();
  const [doc, lookups] = await Promise.all([
    prisma.document.findUnique({
      where: { id: params.id },
      include: { items: { orderBy: { position: "asc" }, include: { batch: { select: { number: true, expiryDate: true } } } } },
    }),
    documentLookups(),
  ]);
  if (!doc) notFound();
  if (!isEditable(doc.status)) redirect(`/documents/${doc.id}`);
  const perms = { edit: can(user.permissions, "documents", "edit"), create: can(user.permissions, "documents", "create") };
  if (!canChangeDocument(perms, doc, user.id)) return <Forbidden />;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumb={
          <Link href={`/documents/${doc.id}`} className="inline-flex items-center gap-1 hover:text-ink">
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            <span dir="ltr">{doc.number}</span>
          </Link>
        }
        title={dict.documents.editTitle}
        badge={<StatusBadge status={doc.status} label={dict.status[doc.status]} />}
        description={<span className="font-mono" dir="ltr">{doc.number}</span>}
      />
      <DocumentForm
        mode="edit"
        id={doc.id}
        number={doc.number}
        status={doc.status}
        today={todayIso()}
        {...lookups}
        initial={{
          type: doc.type as DocType,
          date: doc.date.toISOString().slice(0, 10),
          warehouseId: doc.warehouseId,
          toWarehouseId: doc.toWarehouseId ?? "",
          supplierId: doc.supplierId ?? "",
          referenceNumber: doc.referenceNumber ?? "",
          notes: doc.notes ?? "",
          currency: doc.currency,
          exchangeRate: Number(doc.exchangeRate).toString(),
          lines: doc.items.map((it) => ({
            key: it.id,
            productId: it.productId,
            batchId: it.batchId ?? "",
            batchNumber: it.batchNumber ?? it.batch?.number ?? "",
            expiryDate: (it.expiryDate ?? it.batch?.expiryDate)?.toISOString().slice(0, 10) ?? "",
            quantity: it.quantity.toString(),
            unitPrice: it.unitPrice.toFixed(2),
            discount: Number(it.discount) ? it.discount.toFixed(2) : "",
            taxRate: it.taxRate.toString(),
          })),
        }}
      />
    </div>
  );
}
