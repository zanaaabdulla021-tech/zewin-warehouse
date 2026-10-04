import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/module-states";
import { StockHeader } from "../stock-header";
import { MovementsTable, type MovementRow } from "./movements-table";

export const metadata = { title: "Stock movements" };

export default async function MovementsPage({ searchParams }: { searchParams: { ref?: string } }) {
  const user = await getSessionUser();
  if (!can(user.permissions, "stock")) return <Forbidden />;

  const moves = await prisma.stockMovement.findMany({
    orderBy: { createdAt: "desc" },
    take: 1000,
    include: {
      warehouse: { select: { name: true } },
      product: { select: { id: true, name: true, code: true, unit: { select: { symbol: true } } } },
      batch: { select: { number: true } },
    },
  });
  const whNames = new Map(
    (await prisma.warehouse.findMany({ select: { id: true, name: true } })).map((w) => [w.id, w.name]),
  );

  const rows: MovementRow[] = moves.map((m) => ({
    id: m.id,
    at: m.createdAt.toISOString(),
    reference: m.reference,
    type: m.type,
    productId: m.product.id,
    product: m.product.name,
    code: m.product.code,
    unit: m.product.unit?.symbol ?? "",
    batch: m.batch?.number ?? null,
    warehouse: m.warehouse.name,
    counterpart: m.counterpartWarehouseId ? whNames.get(m.counterpartWarehouseId) ?? null : null,
    qty: Number(m.quantity),
    value: Number(m.quantity) * Number(m.unitCost ?? 0),
    by: m.createdByName,
    note: m.note,
  }));

  return (
    <>
      <StockHeader user={user} active="movements" />
      <MovementsTable rows={rows} initialQuery={searchParams.ref} canExport={can(user.permissions, "stock", "export")} />
    </>
  );
}
