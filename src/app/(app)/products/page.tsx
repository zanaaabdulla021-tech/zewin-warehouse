import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { Forbidden } from "@/components/layout/module-states";
import { ProductList, type ProductRow } from "./product-list";
import { productStockSummary } from "./queries";

export const metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }: { searchParams: { filter?: string } }) {
  const user = await getSessionUser();
  if (!can(user.permissions, "products")) return <Forbidden />;

  const [products, stock] = await Promise.all([
    prisma.product.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
      include: { category: { select: { name: true } }, unit: { select: { symbol: true } } },
    }),
    productStockSummary(),
  ]);

  const rows: ProductRow[] = products.map((p) => {
    const s = stock.get(p.id);
    const qty = s?.qty ?? 0;
    const min = Number(p.minQuantity);
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      barcode: p.barcode,
      imageUrl: p.imageUrl,
      category: p.category?.name ?? null,
      unit: p.unit?.symbol ?? "",
      buy: Number(p.purchasePrice),
      sell: Number(p.sellingPrice),
      qty,
      min,
      warehouses: s?.warehouses ?? 0,
      nearestExpiry: s?.nearest ? new Date(s.nearest).toISOString() : null,
      low: min > 0 && qty < min,
      status: p.status,
    };
  });

  return (
    <ProductList
      rows={rows}
      initialFilter={searchParams.filter === "low" ? "LOW" : undefined}
      perms={{
        create: can(user.permissions, "products", "create"),
        edit: can(user.permissions, "products", "edit"),
        delete: can(user.permissions, "products", "delete"),
        export: can(user.permissions, "products", "export"),
      }}
    />
  );
}
