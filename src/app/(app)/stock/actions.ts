"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { postStockOperation, StockError, STOCK_OP_TYPES, type StockLine } from "@/lib/stock";
import { getDict } from "@/i18n/server";
import { interpolate as t } from "@/i18n/config";
import type { StockOpInput, StockOpResult } from "./types";

const QTY = /^\d{1,11}(\.\d{1,3})?$/;
const MONEY = /^\d{1,12}(\.\d{1,2})?$/;

export async function postStock(input: StockOpInput): Promise<StockOpResult> {
  const user = await getSessionUser();
  const dict = getDict();
  const v = dict.validation;
  const s = dict.stock;

  if (!STOCK_OP_TYPES.includes(input.type)) return { ok: false, message: dict.common.errorToast };
  const needed = input.type === "ADJUSTMENT" ? "edit" : "create";
  if (!can(user.permissions, "stock", needed)) return { ok: false, message: dict.common.forbidden };

  // ── header
  const errors: Record<string, string> = {};
  if (!input.warehouseId) errors.warehouseId = t(v.required, { field: input.type === "TRANSFER" ? s.fromWarehouse : s.warehouse });
  if (input.type === "TRANSFER") {
    if (!input.toWarehouseId) errors.toWarehouseId = t(v.required, { field: s.toWarehouse });
    else if (input.toWarehouseId === input.warehouseId) errors.toWarehouseId = v.sameWarehouse;
  }
  const date = input.date ? new Date(input.date) : new Date();
  if (Number.isNaN(+date)) errors.date = v.invalidDate;

  // ── lines (ignore completely empty rows)
  const rows = input.lines.filter((l) => l.productId || l.quantity);
  if (!rows.length) errors.lines = v.noItems;

  const products = await prisma.product.findMany({
    where: { id: { in: rows.map((r) => r.productId).filter(Boolean) } },
    select: { id: true, tracksBatch: true, tracksExpiry: true },
  });
  const pmap = new Map(products.map((p) => [p.id, p]));

  const lines: StockLine[] = [];
  rows.forEach((r, i) => {
    const k = (f: string) => `${r.key}.${f}`;
    const p = pmap.get(r.productId);
    if (!p) {
      errors[k("productId")] = t(v.required, { field: s.product });
      return;
    }
    const qtyOk = QTY.test(r.quantity.trim());
    const qty = Number(r.quantity);
    if (!qtyOk) errors[k("quantity")] = v.invalidQuantity;
    else if (input.type !== "ADJUSTMENT" && qty <= 0) errors[k("quantity")] = v.qtyPositive;

    const isNewBatch = input.type === "STOCK_IN" || (input.type === "ADJUSTMENT" && !r.batchId);
    if (isNewBatch) {
      if (p.tracksBatch && !r.batchNumber.trim()) errors[k("batchNumber")] = v.batchRequired;
      if (p.tracksExpiry && r.batchNumber.trim() && !r.expiryDate) errors[k("expiryDate")] = v.expiryRequired;
    }
    let expiry: Date | null = null;
    if (r.expiryDate) {
      expiry = new Date(r.expiryDate);
      if (Number.isNaN(+expiry)) errors[k("expiryDate")] = v.invalidDate;
    }
    if (r.unitCost && !MONEY.test(r.unitCost.trim())) errors[k("unitCost")] = v.invalidPrice;

    lines.push({
      productId: r.productId,
      batchId: isNewBatch ? null : r.batchId || null,
      batchNumber: isNewBatch ? r.batchNumber.trim() || null : null,
      expiryDate: expiry,
      quantity: qty,
      unitCost: r.unitCost ? Number(r.unitCost) : null,
    });
  });

  if (Object.keys(errors).length) return { ok: false, message: errors.lines ?? v.fixErrors, errors };

  try {
    const { reference } = await prisma.$transaction(
      async (tx) => {
        const res = await postStockOperation(
          tx,
          { type: input.type, warehouseId: input.warehouseId, toWarehouseId: input.toWarehouseId || null, note: input.note.trim(), lines },
          user,
        );
        // keep the operation date the user picked (time = now)
        if (input.date) {
          const at = new Date(input.date);
          const now = new Date();
          at.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
          await tx.stockMovement.updateMany({ where: { reference: res.reference }, data: { createdAt: at } });
        }
        return res;
      },
      { timeout: 20000 },
    );
    await audit(user, "created", "stock", { ref: reference }, { type: input.type, lines: lines.length });
    revalidatePath("/stock", "layout");
    revalidatePath("/products", "layout");
    revalidatePath("/warehouses", "layout");
    revalidatePath("/");
    return { ok: true, reference };
  } catch (e) {
    if (e instanceof StockError) {
      if (e.code === "INSUFFICIENT" && e.line !== undefined) {
        const key = `${rows[e.line]!.key}.quantity`;
        return { ok: false, message: v.stockChanged, errors: { [key]: t(v.qtyExceeds, { n: e.available ?? 0 }) } };
      }
      if (e.code === "SAME_WAREHOUSE") return { ok: false, message: v.fixErrors, errors: { toWarehouseId: v.sameWarehouse } };
    }
    console.error("[stock]", e);
    return { ok: false, message: dict.common.errorToast };
  }
}
