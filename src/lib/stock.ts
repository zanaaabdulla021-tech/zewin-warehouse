import "server-only";
import { Prisma } from "@prisma/client";

/**
 * Zewin stock engine.
 * Every quantity change in the system goes through `postStockOperation`
 * inside a transaction: it updates StockLevel rows and writes one
 * StockMovement per affected warehouse/batch. Documents (Phase 4) reuse it.
 */

export const STOCK_OP_TYPES = ["STOCK_IN", "STOCK_OUT", "TRANSFER", "ADJUSTMENT"] as const;
export type StockOpType = (typeof STOCK_OP_TYPES)[number];

export const REF_PREFIX: Record<StockOpType, string> = {
  STOCK_IN: "SI",
  STOCK_OUT: "SO",
  TRANSFER: "TR",
  ADJUSTMENT: "ADJ",
};

export type StockLine = {
  productId: string;
  /** existing batch (OUT / TRANSFER / ADJUSTMENT of an existing batch) */
  batchId?: string | null;
  /** new or existing batch number (IN / ADJUSTMENT) */
  batchNumber?: string | null;
  expiryDate?: Date | null;
  /** quantity moved; for ADJUSTMENT this is the counted quantity */
  quantity: number;
  unitCost?: number | null;
};

export type StockOperation = {
  type: StockOpType;
  warehouseId: string;
  toWarehouseId?: string | null;
  note?: string | null;
  documentId?: string | null;
  lines: StockLine[];
};

export class StockError extends Error {
  constructor(
    public code: "INSUFFICIENT" | "SAME_WAREHOUSE" | "NOT_FOUND" | "NO_LINES",
    public line?: number,
    public available?: number,
  ) {
    super(code);
    this.name = "StockError";
  }
}

type Tx = Prisma.TransactionClient;

async function nextReference(tx: Tx, type: StockOpType) {
  const prefix = REF_PREFIX[type] + "-";
  const last = await tx.stockMovement.findFirst({
    where: { reference: { startsWith: prefix } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });
  const n = last?.reference ? Number(last.reference.slice(prefix.length)) || 0 : 0;
  return prefix + String(n + 1).padStart(6, "0");
}

async function resolveBatch(tx: Tx, line: StockLine): Promise<string | null> {
  if (line.batchId) return line.batchId;
  const number = line.batchNumber?.trim();
  if (!number) return null;
  const batch = await tx.batch.upsert({
    where: { productId_number: { productId: line.productId, number } },
    update: line.expiryDate ? { expiryDate: line.expiryDate } : {},
    create: { productId: line.productId, number, expiryDate: line.expiryDate ?? null },
  });
  return batch.id;
}

/** StockLevel's unique key contains a nullable batchId, so look it up explicitly. */
async function findLevel(tx: Tx, warehouseId: string, productId: string, batchId: string | null) {
  return tx.stockLevel.findFirst({ where: { warehouseId, productId, batchId } });
}

async function addQty(tx: Tx, warehouseId: string, productId: string, batchId: string | null, qty: number) {
  const level = await findLevel(tx, warehouseId, productId, batchId);
  if (level) {
    await tx.stockLevel.update({ where: { id: level.id }, data: { quantity: { increment: qty } } });
  } else {
    await tx.stockLevel.create({ data: { warehouseId, productId, batchId, quantity: qty } });
  }
}

/** Atomic decrement that fails instead of going negative. */
async function takeQty(tx: Tx, warehouseId: string, productId: string, batchId: string | null, qty: number, line: number) {
  const level = await findLevel(tx, warehouseId, productId, batchId);
  const available = level ? Number(level.quantity) : 0;
  if (!level) throw new StockError("INSUFFICIENT", line, 0);
  const res = await tx.stockLevel.updateMany({
    where: { id: level.id, quantity: { gte: qty } },
    data: { quantity: { decrement: qty } },
  });
  if (res.count === 0) throw new StockError("INSUFFICIENT", line, available);
}

export async function postStockOperation(
  tx: Tx,
  op: StockOperation,
  user: { id: string; name: string },
): Promise<{ reference: string; movements: number }> {
  if (!op.lines.length) throw new StockError("NO_LINES");
  if (op.type === "TRANSFER" && (!op.toWarehouseId || op.toWarehouseId === op.warehouseId)) {
    throw new StockError("SAME_WAREHOUSE");
  }

  const reference = await nextReference(tx, op.type);
  const products = await tx.product.findMany({
    where: { id: { in: [...new Set(op.lines.map((l) => l.productId))] } },
    select: { id: true, purchasePrice: true },
  });
  const cost = new Map(products.map((p) => [p.id, Number(p.purchasePrice)]));

  const base = {
    reference,
    note: op.note || null,
    documentId: op.documentId ?? null,
    createdById: user.id,
    createdByName: user.name,
  };
  let movements = 0;

  for (const [i, line] of op.lines.entries()) {
    if (!cost.has(line.productId)) throw new StockError("NOT_FOUND", i);
    const batchId = await resolveBatch(tx, line);
    const unitCost = line.unitCost ?? cost.get(line.productId)!;
    const q = line.quantity;

    switch (op.type) {
      case "STOCK_IN": {
        await addQty(tx, op.warehouseId, line.productId, batchId, q);
        await tx.stockMovement.create({
          data: { ...base, type: "STOCK_IN", warehouseId: op.warehouseId, productId: line.productId, batchId, quantity: q, unitCost },
        });
        movements++;
        break;
      }
      case "STOCK_OUT": {
        await takeQty(tx, op.warehouseId, line.productId, batchId, q, i);
        await tx.stockMovement.create({
          data: { ...base, type: "STOCK_OUT", warehouseId: op.warehouseId, productId: line.productId, batchId, quantity: -q, unitCost },
        });
        movements++;
        break;
      }
      case "TRANSFER": {
        const to = op.toWarehouseId!;
        await takeQty(tx, op.warehouseId, line.productId, batchId, q, i);
        await addQty(tx, to, line.productId, batchId, q);
        await tx.stockMovement.createMany({
          data: [
            { ...base, type: "TRANSFER_OUT", warehouseId: op.warehouseId, counterpartWarehouseId: to, productId: line.productId, batchId, quantity: -q, unitCost },
            { ...base, type: "TRANSFER_IN", warehouseId: to, counterpartWarehouseId: op.warehouseId, productId: line.productId, batchId, quantity: q, unitCost },
          ],
        });
        movements += 2;
        break;
      }
      case "ADJUSTMENT": {
        const level = await findLevel(tx, op.warehouseId, line.productId, batchId);
        const current = level ? Number(level.quantity) : 0;
        const delta = +(q - current).toFixed(3);
        if (delta === 0) break;
        if (level) await tx.stockLevel.update({ where: { id: level.id }, data: { quantity: q } });
        else await tx.stockLevel.create({ data: { warehouseId: op.warehouseId, productId: line.productId, batchId, quantity: q } });
        await tx.stockMovement.create({
          data: { ...base, type: "ADJUSTMENT", warehouseId: op.warehouseId, productId: line.productId, batchId, quantity: delta, unitCost },
        });
        movements++;
        break;
      }
    }
  }

  return { reference, movements };
}
