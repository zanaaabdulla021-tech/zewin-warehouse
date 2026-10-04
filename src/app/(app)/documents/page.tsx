import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/module-states";
import { DocumentList, type DocRow } from "./document-list";

export const metadata = { title: "Documents" };

export default async function DocumentsPage({ searchParams }: { searchParams: { type?: string; status?: string } }) {
  const user = await getSessionUser();
  if (!can(user.permissions, "documents")) return <Forbidden />;

  const docs = await prisma.document.findMany({
    orderBy: [{ date: "desc" }, { number: "desc" }],
    take: 1000,
    include: {
      warehouse: { select: { name: true } },
      toWarehouse: { select: { name: true } },
      supplier: { select: { name: true } },
      createdBy: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });

  const rows: DocRow[] = docs.map((d) => ({
    id: d.id,
    number: d.number,
    type: d.type,
    status: d.status,
    date: d.date.toISOString(),
    warehouse: d.warehouse.name,
    party: d.toWarehouse?.name ?? d.supplier?.name ?? null,
    isTransfer: !!d.toWarehouse,
    referenceNumber: d.referenceNumber,
    items: d._count.items,
    total: Number(d.grandTotal),
    currency: d.currency,
    createdBy: d.createdBy.name,
    mine: d.createdById === user.id,
  }));

  return (
    <DocumentList
      rows={rows}
      initialStatus={searchParams.status?.toUpperCase()}
      perms={{
        create: can(user.permissions, "documents", "create"),
        edit: can(user.permissions, "documents", "edit"),
        delete: can(user.permissions, "documents", "delete"),
        own: can(user.permissions, "documents", "create"),
        export: can(user.permissions, "documents", "export"),
      }}
    />
  );
}
