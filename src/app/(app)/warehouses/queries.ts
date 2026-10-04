import "server-only";
import { prisma } from "@/lib/prisma";

export async function nextWarehouseCode() {
  const rows = await prisma.warehouse.findMany({ where: { code: { startsWith: "WH-" } }, select: { code: true } });
  const max = rows.reduce((m, r) => Math.max(m, Number(r.code.slice(3)) || 0), 0);
  return `WH-${String(max + 1).padStart(3, "0")}`;
}

export async function managerOptions() {
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE", role: { key: { in: ["SUPER_ADMIN", "ADMIN", "WAREHOUSE_MANAGER"] } } },
    select: { id: true, name: true, role: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  return users.map((u) => ({ value: u.id, label: u.name, meta: u.role.name }));
}

/** Per-warehouse product count, units and value in one query. */
export async function warehouseStockSummary() {
  const rows = await prisma.$queryRaw<{ warehouseId: string; products: number; units: number; value: number }[]>`
    SELECT s."warehouseId",
           COUNT(DISTINCT s."productId")::int AS products,
           COALESCE(SUM(s."quantity"), 0)::float AS units,
           COALESCE(SUM(s."quantity" * p."purchasePrice"), 0)::float AS value
    FROM "StockLevel" s JOIN "Product" p ON p."id" = s."productId"
    WHERE s."quantity" > 0
    GROUP BY s."warehouseId"`;
  return new Map(rows.map((r) => [r.warehouseId, r]));
}
