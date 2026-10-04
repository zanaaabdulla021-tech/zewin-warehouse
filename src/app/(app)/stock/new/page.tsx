import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getDict } from "@/i18n/server";
import { STOCK_OP_TYPES, type StockOpType } from "@/lib/stock";
import { Forbidden } from "@/components/layout/module-states";
import { PageHeader } from "@/components/ui/card";
import { StockForm } from "./stock-form";

export const metadata = { title: "New stock operation" };

export default async function NewStockOperationPage({
  searchParams,
}: {
  searchParams: { type?: string; warehouse?: string };
}) {
  const user = await getSessionUser();
  const allowed = STOCK_OP_TYPES.filter((t) => can(user.permissions, "stock", t === "ADJUSTMENT" ? "edit" : "create"));
  if (!allowed.length) return <Forbidden />;
  const dict = getDict();

  const [warehouses, products, levels] = await Promise.all([
    prisma.warehouse.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
    prisma.product.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, barcode: true, purchasePrice: true, tracksBatch: true, tracksExpiry: true, unit: { select: { symbol: true } } },
    }),
    prisma.stockLevel.findMany({
      select: {
        warehouseId: true,
        productId: true,
        batchId: true,
        quantity: true,
        batch: { select: { number: true, expiryDate: true } },
      },
    }),
  ]);

  const requested = searchParams.type as StockOpType | undefined;
  const initialType = requested && allowed.includes(requested) ? requested : allowed[0]!;
  const initialWarehouse =
    warehouses.find((w) => w.id === searchParams.warehouse)?.id ?? (warehouses.length === 1 ? warehouses[0]!.id : "");

  // local date in the server's timezone is fine for a default value
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumb={
          <Link href="/stock" className="inline-flex items-center gap-1 hover:text-ink">
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            {dict.stock.title}
          </Link>
        }
        title={dict.stock.newOperation}
      />
      <StockForm
        initialType={initialType}
        initialWarehouseId={initialWarehouse}
        allowedTypes={allowed}
        today={today}
        warehouses={warehouses.map((w) => ({ value: w.id, label: w.name, meta: w.code }))}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          code: p.code,
          barcode: p.barcode,
          unit: p.unit?.symbol ?? "",
          cost: Number(p.purchasePrice),
          tracksBatch: p.tracksBatch,
          tracksExpiry: p.tracksExpiry,
        }))}
        levels={levels.map((l) => ({
          warehouseId: l.warehouseId,
          productId: l.productId,
          batchId: l.batchId,
          batchNumber: l.batch?.number ?? null,
          expiryDate: l.batch?.expiryDate ? l.batch.expiryDate.toISOString().slice(0, 10) : null,
          quantity: Number(l.quantity),
        }))}
      />
    </div>
  );
}
