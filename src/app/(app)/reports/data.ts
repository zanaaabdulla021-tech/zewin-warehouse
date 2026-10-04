import "server-only";
import { prisma } from "@/lib/prisma";
import type { Dictionary } from "@/i18n/en";

export const REPORT_KEYS = ["stock", "warehouse", "product", "accounting", "verification", "supplier", "movement"] as const;
export type ReportKey = (typeof REPORT_KEYS)[number];

export type ColType = "text" | "mono" | "number" | "money" | "date" | "signed";
export type ReportColumn = { key: string; label: string; type: ColType };
export type ReportRow = Record<string, string | number | null>;
export type ReportData = {
  kpis: { label: string; value: number; type: "number" | "money" }[];
  columns: ReportColumn[];
  rows: ReportRow[];
  snapshot?: boolean;
};

export type ReportFilters = { from: Date; to: Date; warehouseId: string | null };

const num = (v: unknown) => Number(v ?? 0);

export async function buildReport(key: ReportKey, f: ReportFilters, dict: Dictionary): Promise<ReportData> {
  const r = dict.reports;
  const s = dict.stock;
  const d = dict.documents;
  const range = { gte: f.from, lte: f.to };
  const wh = f.warehouseId ? { warehouseId: f.warehouseId } : {};

  switch (key) {
    case "stock": {
      const levels = await prisma.stockLevel.findMany({
        where: { quantity: { gt: 0 }, ...wh },
        include: {
          warehouse: { select: { name: true } },
          product: { select: { name: true, code: true, purchasePrice: true, unit: { select: { symbol: true } } } },
          batch: { select: { number: true, expiryDate: true } },
        },
        orderBy: [{ product: { name: "asc" } }],
      });
      const rows = levels.map((l) => ({
        product: l.product.name,
        code: l.product.code,
        warehouse: l.warehouse.name,
        batch: l.batch?.number ?? null,
        expiry: l.batch?.expiryDate?.toISOString() ?? null,
        qty: num(l.quantity),
        unit: l.product.unit?.symbol ?? "",
        value: num(l.quantity) * num(l.product.purchasePrice),
      }));
      return {
        snapshot: true,
        kpis: [
          { label: r.units, value: rows.reduce((a, x) => a + x.qty, 0), type: "number" },
          { label: r.value, value: rows.reduce((a, x) => a + x.value, 0), type: "money" },
          { label: r.products, value: new Set(rows.map((x) => x.code)).size, type: "number" },
        ],
        columns: [
          { key: "product", label: s.product, type: "text" },
          { key: "code", label: dict.products.code, type: "mono" },
          { key: "warehouse", label: s.warehouse, type: "text" },
          { key: "batch", label: s.batch, type: "mono" },
          { key: "expiry", label: s.expiry, type: "date" },
          { key: "qty", label: s.onHand, type: "number" },
          { key: "unit", label: dict.products.unit, type: "text" },
          { key: "value", label: r.value, type: "money" },
        ],
        rows,
      };
    }

    case "warehouse": {
      const [warehouses, stock, moves, docs] = await Promise.all([
        prisma.warehouse.findMany({ where: f.warehouseId ? { id: f.warehouseId } : { status: { not: "ARCHIVED" } }, orderBy: { name: "asc" } }),
        prisma.$queryRaw<{ warehouseId: string; products: number; units: number; value: number }[]>`
          SELECT s."warehouseId", COUNT(DISTINCT s."productId")::int AS products,
                 COALESCE(SUM(s."quantity"),0)::float AS units,
                 COALESCE(SUM(s."quantity" * p."purchasePrice"),0)::float AS value
          FROM "StockLevel" s JOIN "Product" p ON p."id" = s."productId"
          WHERE s."quantity" > 0 GROUP BY s."warehouseId"`,
        prisma.stockMovement.groupBy({ by: ["warehouseId"], where: { createdAt: range, ...wh }, _count: true }),
        prisma.document.groupBy({ by: ["warehouseId"], where: { date: range, ...wh }, _count: true }),
      ]);
      const sm = new Map(stock.map((x) => [x.warehouseId, x]));
      const mm = new Map(moves.map((x) => [x.warehouseId, x._count]));
      const dm = new Map(docs.map((x) => [x.warehouseId, x._count]));
      const rows = warehouses.map((w) => ({
        warehouse: w.name,
        code: w.code,
        products: sm.get(w.id)?.products ?? 0,
        units: sm.get(w.id)?.units ?? 0,
        value: sm.get(w.id)?.value ?? 0,
        movements: mm.get(w.id) ?? 0,
        documents: dm.get(w.id) ?? 0,
      }));
      return {
        kpis: [
          { label: dict.nav.warehouses, value: rows.length, type: "number" },
          { label: r.value, value: rows.reduce((a, x) => a + x.value, 0), type: "money" },
          { label: r.movements, value: rows.reduce((a, x) => a + x.movements, 0), type: "number" },
        ],
        columns: [
          { key: "warehouse", label: s.warehouse, type: "text" },
          { key: "code", label: dict.warehouses.code, type: "mono" },
          { key: "products", label: r.products, type: "number" },
          { key: "units", label: r.units, type: "number" },
          { key: "value", label: r.value, type: "money" },
          { key: "movements", label: r.movements, type: "number" },
          { key: "documents", label: r.documents, type: "number" },
        ],
        rows,
      };
    }

    case "product": {
      const moves = await prisma.stockMovement.findMany({
        where: { createdAt: range, ...wh },
        select: { productId: true, quantity: true, unitCost: true },
      });
      const agg = new Map<string, { inQ: number; outQ: number; value: number }>();
      for (const m of moves) {
        const a = agg.get(m.productId) ?? { inQ: 0, outQ: 0, value: 0 };
        const q = num(m.quantity);
        if (q > 0) a.inQ += q;
        else a.outQ += -q;
        a.value += q * num(m.unitCost);
        agg.set(m.productId, a);
      }
      const [products, onHand] = await Promise.all([
        prisma.product.findMany({ where: { id: { in: [...agg.keys()] } }, include: { unit: { select: { symbol: true } } } }),
        prisma.stockLevel.groupBy({ by: ["productId"], where: { productId: { in: [...agg.keys()] }, ...wh }, _sum: { quantity: true } }),
      ]);
      const oh = new Map(onHand.map((x) => [x.productId, num(x._sum.quantity)]));
      const rows = products
        .map((p) => {
          const a = agg.get(p.id)!;
          return {
            product: p.name,
            code: p.code,
            in: a.inQ,
            out: a.outQ,
            net: +(a.inQ - a.outQ).toFixed(3),
            value: a.value,
            onHand: oh.get(p.id) ?? 0,
            unit: p.unit?.symbol ?? "",
          };
        })
        .sort((a, b) => b.in + b.out - (a.in + a.out));
      return {
        kpis: [
          { label: r.totalIn, value: rows.reduce((a, x) => a + x.in, 0), type: "number" },
          { label: r.totalOut, value: rows.reduce((a, x) => a + x.out, 0), type: "number" },
          { label: r.products, value: rows.length, type: "number" },
        ],
        columns: [
          { key: "product", label: s.product, type: "text" },
          { key: "code", label: dict.products.code, type: "mono" },
          { key: "in", label: r.totalIn, type: "number" },
          { key: "out", label: r.totalOut, type: "number" },
          { key: "net", label: r.net, type: "signed" },
          { key: "value", label: r.value, type: "money" },
          { key: "onHand", label: s.onHand, type: "number" },
          { key: "unit", label: dict.products.unit, type: "text" },
        ],
        rows,
      };
    }

    case "accounting": {
      // documents may be in different currencies — convert each one to base before summing
      const docs = await prisma.document.findMany({
        where: { date: range, ...wh },
        select: { type: true, status: true, subtotal: true, discountTotal: true, taxTotal: true, grandTotalBase: true, exchangeRate: true },
        orderBy: [{ type: "asc" }, { status: "asc" }],
      });
      const agg = new Map<string, { type: typeof docs[number]["type"]; status: typeof docs[number]["status"]; n: number; sub: number; dis: number; tax: number; tot: number }>();
      for (const x of docs) {
        const k = `${x.type}|${x.status}`;
        const a = agg.get(k) ?? { type: x.type, status: x.status, n: 0, sub: 0, dis: 0, tax: 0, tot: 0 };
        const rate = num(x.exchangeRate) || 1;
        a.n++;
        a.sub += num(x.subtotal) * rate;
        a.dis += num(x.discountTotal) * rate;
        a.tax += num(x.taxTotal) * rate;
        a.tot += num(x.grandTotalBase);
        agg.set(k, a);
      }
      const rows = [...agg.values()].map((g) => ({
        type: dict.docType[g.type],
        status: dict.status[g.status],
        documents: g.n,
        subtotal: g.sub,
        discount: g.dis,
        tax: g.tax,
        total: g.tot,
        _status: g.status,
      }));
      const sumBy = (st: string) => rows.filter((x) => x._status === st).reduce((a, x) => a + x.total, 0);
      return {
        kpis: [
          { label: r.verified, value: sumBy("VERIFIED"), type: "money" },
          { label: r.pending, value: sumBy("PENDING"), type: "money" },
          { label: r.documents, value: rows.reduce((a, x) => a + x.documents, 0), type: "number" },
        ],
        columns: [
          { key: "type", label: d.type, type: "text" },
          { key: "status", label: dict.common.status, type: "text" },
          { key: "documents", label: r.documents, type: "number" },
          { key: "subtotal", label: d.subtotal, type: "money" },
          { key: "discount", label: d.discount, type: "money" },
          { key: "tax", label: d.tax, type: "money" },
          { key: "total", label: d.grandTotal, type: "money" },
        ],
        rows: rows.map(({ _status, ...x }) => x),
      };
    }

    case "verification": {
      const vs = await prisma.verification.findMany({
        where: { createdAt: range, ...(f.warehouseId ? { document: { warehouseId: f.warehouseId } } : {}) },
        include: { user: { select: { name: true } }, document: { select: { grandTotalBase: true, submittedAt: true } } },
      });
      const agg = new Map<string, { reviewer: string; verified: number; rejected: number; value: number; hours: number[] }>();
      for (const v of vs) {
        const a = agg.get(v.userId) ?? { reviewer: v.user.name, verified: 0, rejected: 0, value: 0, hours: [] };
        if (v.result === "VERIFIED") {
          a.verified++;
          a.value += num(v.document.grandTotalBase);
        } else a.rejected++;
        if (v.document.submittedAt) a.hours.push((+v.createdAt - +v.document.submittedAt) / 3600000);
        agg.set(v.userId, a);
      }
      const rows = [...agg.values()].map((a) => ({
        reviewer: a.reviewer,
        verified: a.verified,
        rejected: a.rejected,
        value: a.value,
        avgHours: a.hours.length ? +(a.hours.reduce((x, y) => x + y, 0) / a.hours.length).toFixed(1) : null,
      }));
      return {
        kpis: [
          { label: r.verified, value: rows.reduce((a, x) => a + x.verified, 0), type: "number" },
          { label: r.rejected, value: rows.reduce((a, x) => a + x.rejected, 0), type: "number" },
          { label: r.value, value: rows.reduce((a, x) => a + x.value, 0), type: "money" },
        ],
        columns: [
          { key: "reviewer", label: r.reviewer, type: "text" },
          { key: "verified", label: r.verified, type: "number" },
          { key: "rejected", label: r.rejected, type: "number" },
          { key: "value", label: r.value, type: "money" },
          { key: "avgHours", label: r.avgHours, type: "number" },
        ],
        rows,
      };
    }

    case "supplier": {
      const groups = await prisma.document.groupBy({
        by: ["supplierId", "type"],
        where: { date: range, status: "VERIFIED", supplierId: { not: null }, type: { in: ["PURCHASE", "RETURN"] }, ...wh },
        _count: true,
        _sum: { grandTotalBase: true },
      });
      const suppliers = await prisma.supplier.findMany({ where: { id: { in: groups.map((g) => g.supplierId!) } } });
      const rows = suppliers
        .map((sup) => {
          const p = groups.find((g) => g.supplierId === sup.id && g.type === "PURCHASE");
          const rt = groups.find((g) => g.supplierId === sup.id && g.type === "RETURN");
          const purchases = num(p?._sum.grandTotalBase);
          const returns = num(rt?._sum.grandTotalBase);
          return {
            supplier: sup.name,
            code: sup.code,
            documents: (p?._count ?? 0) + (rt?._count ?? 0),
            purchases,
            returns,
            net: purchases - returns,
          };
        })
        .sort((a, b) => b.net - a.net);
      return {
        kpis: [
          { label: r.purchases, value: rows.reduce((a, x) => a + x.purchases, 0), type: "money" },
          { label: r.returns, value: rows.reduce((a, x) => a + x.returns, 0), type: "money" },
          { label: dict.nav.suppliers, value: rows.length, type: "number" },
        ],
        columns: [
          { key: "supplier", label: dict.suppliers.colSupplier, type: "text" },
          { key: "code", label: dict.suppliers.code, type: "mono" },
          { key: "documents", label: r.documents, type: "number" },
          { key: "purchases", label: r.purchases, type: "money" },
          { key: "returns", label: r.returns, type: "money" },
          { key: "net", label: r.net, type: "money" },
        ],
        rows,
      };
    }

    case "movement": {
      const moves = await prisma.stockMovement.findMany({
        where: { createdAt: range, ...wh },
        orderBy: { createdAt: "desc" },
        take: 3000,
        include: {
          warehouse: { select: { name: true } },
          product: { select: { name: true, code: true } },
          batch: { select: { number: true } },
        },
      });
      const rows = moves.map((m) => ({
        date: m.createdAt.toISOString(),
        reference: m.reference,
        type: s.movementTypes[m.type],
        product: m.product.name,
        batch: m.batch?.number ?? null,
        warehouse: m.warehouse.name,
        qty: num(m.quantity),
        value: num(m.quantity) * num(m.unitCost),
        by: m.createdByName,
      }));
      return {
        kpis: [
          { label: r.movements, value: rows.length, type: "number" },
          { label: r.totalIn, value: rows.filter((x) => x.qty > 0).reduce((a, x) => a + x.qty, 0), type: "number" },
          { label: r.totalOut, value: rows.filter((x) => x.qty < 0).reduce((a, x) => a - x.qty, 0), type: "number" },
        ],
        columns: [
          { key: "date", label: s.date, type: "date" },
          { key: "reference", label: s.reference, type: "mono" },
          { key: "type", label: d.type, type: "text" },
          { key: "product", label: s.product, type: "text" },
          { key: "batch", label: s.batch, type: "mono" },
          { key: "warehouse", label: s.warehouse, type: "text" },
          { key: "qty", label: s.quantity, type: "signed" },
          { key: "value", label: r.value, type: "money" },
          { key: "by", label: s.by, type: "text" },
        ],
        rows,
      };
    }
  }
}
