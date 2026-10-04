import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/module-states";
import { toPlain } from "@/lib/utils";
import { WarehouseList } from "./warehouse-list";
import { managerOptions, nextWarehouseCode, warehouseStockSummary } from "./queries";

export const metadata = { title: "Warehouses" };

export default async function WarehousesPage({ searchParams }: { searchParams: { new?: string } }) {
  const user = await getSessionUser();
  if (!can(user.permissions, "warehouses")) return <Forbidden />;

  const [warehouses, summary, managers, nextCode] = await Promise.all([
    prisma.warehouse.findMany({
      orderBy: [{ status: "asc" }, { code: "asc" }],
      include: { manager: { select: { id: true, name: true } }, _count: { select: { employees: true } } },
    }),
    warehouseStockSummary(),
    managerOptions(),
    nextWarehouseCode(),
  ]);

  const rows = warehouses.map((w) => {
    const s = summary.get(w.id);
    return {
      id: w.id,
      code: w.code,
      name: w.name,
      type: w.type,
      city: w.city,
      address: w.address,
      status: w.status,
      manager: w.manager?.name ?? null,
      employees: w._count.employees,
      products: s?.products ?? 0,
      value: s?.value ?? 0,
    };
  });

  return (
    <WarehouseList
      rows={toPlain(rows)}
      managers={managers}
      nextCode={nextCode}
      openNew={searchParams.new === "1"}
      perms={{
        create: can(user.permissions, "warehouses", "create"),
        edit: can(user.permissions, "warehouses", "edit"),
        delete: can(user.permissions, "warehouses", "delete"),
        export: can(user.permissions, "warehouses", "export"),
      }}
    />
  );
}
