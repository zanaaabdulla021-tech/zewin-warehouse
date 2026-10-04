import "server-only";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";
import { getBaseCurrencyCode } from "@/lib/utils";
import type { DocLevel, DocProduct } from "./document-form";

/** Everything the document form needs to pick from. */
export async function documentLookups() {
  const { defaultTaxRate } = await getAppSettings();
  const base = getBaseCurrencyCode();
  const [warehouses, suppliers, products, levels, currencies] = await Promise.all([
    prisma.warehouse.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
    prisma.supplier.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
    prisma.product.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, barcode: true, purchasePrice: true, taxRate: true, unit: { select: { symbol: true } } },
    }),
    prisma.stockLevel.findMany({
      where: { quantity: { gt: 0 } },
      select: { warehouseId: true, productId: true, batchId: true, quantity: true, batch: { select: { number: true, expiryDate: true } } },
    }),
    prisma.currency.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
  ]);
  const curList = currencies.map((c) => ({ code: c.code, name: c.name, rate: c.code === base ? 1 : Number(c.rate) }));
  if (!curList.some((c) => c.code === base)) curList.unshift({ code: base, name: base, rate: 1 });
  return {
    baseCurrency: base,
    currencies: curList.sort((a, b) => (a.code === base ? -1 : b.code === base ? 1 : a.code.localeCompare(b.code))),
    warehouses: warehouses.map((w) => ({ value: w.id, label: w.name, meta: w.code })),
    suppliers: suppliers.map((s) => ({ value: s.id, label: s.name, meta: s.code })),
    products: products.map<DocProduct>((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      barcode: p.barcode,
      unit: p.unit?.symbol ?? "",
      cost: Number(p.purchasePrice),
      taxRate: Number(p.taxRate) || defaultTaxRate,
    })),
    levels: levels.map<DocLevel>((l) => ({
      warehouseId: l.warehouseId,
      productId: l.productId,
      batchId: l.batchId,
      batchNumber: l.batch?.number ?? null,
      expiryDate: l.batch?.expiryDate ? l.batch.expiryDate.toISOString().slice(0, 10) : null,
      quantity: Number(l.quantity),
    })),
  };
}

export const todayIso = () => new Date().toISOString().slice(0, 10);
