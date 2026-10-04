import "server-only";
import { prisma } from "@/lib/prisma";

export async function nextProductCode() {
  const rows = await prisma.product.findMany({ where: { code: { startsWith: "PR-" } }, select: { code: true } });
  const max = rows.reduce((m, r) => Math.max(m, Number(r.code.slice(3)) || 0), 0);
  return `PR-${String(max + 1).padStart(3, "0")}`;
}

export async function catalogOptions() {
  const [categories, units] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, include: { parent: { select: { name: true } } } }),
    prisma.unit.findMany({ orderBy: { name: "asc" } }),
  ]);
  return {
    categories: categories.map((c) => ({ value: c.id, label: c.name, meta: c.parent?.name })),
    units: units.map((u) => ({ value: u.id, label: `${u.name} (${u.symbol})` })),
  };
}

/** Total quantity, value, warehouse count and nearest expiry per product. */
export async function productStockSummary() {
  const rows = await prisma.$queryRaw<
    { productId: string; qty: number; warehouses: number; nearest: Date | null }[]
  >`
    SELECT s."productId",
           COALESCE(SUM(s."quantity"), 0)::float AS qty,
           COUNT(DISTINCT s."warehouseId")::int AS warehouses,
           MIN(b."expiryDate") AS nearest
    FROM "StockLevel" s LEFT JOIN "Batch" b ON b."id" = s."batchId"
    WHERE s."quantity" > 0
    GROUP BY s."productId"`;
  return new Map(rows.map((r) => [r.productId, r]));
}
