import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/module-states";
import { SupplierList, type SupplierRow } from "./supplier-list";

export const metadata = { title: "Suppliers" };

export default async function SuppliersPage() {
  const user = await getSessionUser();
  if (!can(user.permissions, "suppliers")) return <Forbidden />;

  const [suppliers, purchases, counts] = await Promise.all([
    prisma.supplier.findMany({ orderBy: [{ status: "asc" }, { name: "asc" }] }),
    prisma.document.groupBy({
      by: ["supplierId"],
      where: { type: "PURCHASE", status: "VERIFIED", supplierId: { not: null } },
      _sum: { grandTotalBase: true },
    }),
    prisma.document.groupBy({ by: ["supplierId"], where: { supplierId: { not: null } }, _count: true }),
  ]);
  const bought = new Map(purchases.map((p) => [p.supplierId, Number(p._sum.grandTotalBase ?? 0)]));
  const docs = new Map(counts.map((c) => [c.supplierId, c._count]));

  const rows: SupplierRow[] = suppliers.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    contactName: s.contactName,
    phone: s.phone,
    city: s.city,
    status: s.status,
    documents: docs.get(s.id) ?? 0,
    purchased: bought.get(s.id) ?? 0,
  }));

  return (
    <SupplierList
      rows={rows}
      perms={{
        create: can(user.permissions, "suppliers", "create"),
        edit: can(user.permissions, "suppliers", "edit"),
        delete: can(user.permissions, "suppliers", "delete"),
        export: can(user.permissions, "suppliers", "export"),
      }}
    />
  );
}
