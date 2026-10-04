"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { postStockOperation, StockError, type StockOpType } from "@/lib/stock";
import { DOC_STOCK_EFFECT, type DocType } from "@/lib/documents";
import { getDict } from "@/i18n/server";
import { interpolate as t } from "@/i18n/config";
import { CHECKS, type Checklist } from "./checklist";

type Result =
  | { ok: true; stockReference: string | null; nextId: string | null }
  | { ok: false; message: string; line?: number };

const EFFECT_TO_OP: Record<"IN" | "OUT" | "TRANSFER", StockOpType> = { IN: "STOCK_IN", OUT: "STOCK_OUT", TRANSFER: "TRANSFER" };

function cleanChecklist(c: Partial<Checklist>): Checklist {
  return Object.fromEntries(CHECKS.map((k) => [k, !!c[k]])) as Checklist;
}

async function nextPending(excludeId: string) {
  const next = await prisma.document.findFirst({
    where: { status: "PENDING", id: { not: excludeId } },
    orderBy: [{ submittedAt: "asc" }, { date: "asc" }],
    select: { id: true },
  });
  return next?.id ?? null;
}

function revalidate(id: string) {
  revalidatePath("/accounting", "layout");
  revalidatePath("/documents", "layout");
  revalidatePath(`/documents/${id}`);
  revalidatePath("/stock", "layout");
  revalidatePath("/products", "layout");
  revalidatePath("/warehouses", "layout");
  revalidatePath("/");
}

/**
 * Verify: re-checks status, posts the stock movement through the stock engine
 * (linked to the document), stores the checklist and marks the document VERIFIED —
 * all in one transaction, so stock and status can never disagree.
 */
export async function verifyDocument(id: string, checklistIn: Partial<Checklist>, notes: string): Promise<Result> {
  const user = await getSessionUser();
  const dict = getDict();
  const a = dict.accounting;
  if (!can(user.permissions, "accounting", "verify")) return { ok: false, message: dict.common.forbidden };

  const checklist = cleanChecklist(checklistIn);
  if (!CHECKS.every((k) => checklist[k])) return { ok: false, message: a.checklistHint };

  const doc = await prisma.document.findUnique({ where: { id }, include: { items: { orderBy: { position: "asc" } } } });
  if (!doc || doc.status !== "PENDING") return { ok: false, message: a.notPending };

  const effect = DOC_STOCK_EFFECT[doc.type as DocType] ?? "NONE";

  try {
    const stockReference = await prisma.$transaction(
      async (tx) => {
        // lock in the status change first; a concurrent verify/reject makes this update 0 rows
        const claimed = await tx.document.updateMany({
          where: { id, status: "PENDING" },
          data: { status: "VERIFIED", verifiedById: user.id, verifiedAt: new Date() },
        });
        if (claimed.count === 0) throw new Error("NOT_PENDING");

        let ref: string | null = null;
        if (effect !== "NONE") {
          const res = await postStockOperation(
            tx,
            {
              type: EFFECT_TO_OP[effect],
              warehouseId: doc.warehouseId,
              toWarehouseId: doc.toWarehouseId,
              documentId: doc.id,
              note: doc.number,
              lines: doc.items.map((it) => ({
                productId: it.productId,
                batchId: it.batchId,
                batchNumber: it.batchNumber,
                expiryDate: it.expiryDate,
                quantity: Number(it.quantity),
                // net unit cost, converted to the base currency
                unitCost:
                  (Number(it.quantity) ? Number(it.lineTotal) / Number(it.quantity) : Number(it.unitPrice)) * (Number(doc.exchangeRate) || 1),
              })),
            },
            user,
          );
          ref = res.reference;
          await tx.document.update({ where: { id }, data: { stockReference: ref } });
        }
        await tx.verification.create({
          data: { documentId: id, userId: user.id, result: "VERIFIED", checklist, notes: notes.trim() || null },
        });
        return ref;
      },
      { timeout: 20000 },
    );

    await audit(user, "verified", "documents", { id, ref: doc.number }, { stockReference });
    if (doc.createdById !== user.id) {
      await notify({ type: "doc_verified", docId: id, number: doc.number, actor: user.name }, [doc.createdById]);
    }
    revalidate(id);
    return { ok: true, stockReference, nextId: await nextPending(id) };
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_PENDING") return { ok: false, message: a.notPending };
    if (e instanceof StockError && e.code === "INSUFFICIENT") {
      return {
        ok: false,
        line: e.line,
        message: `#${(e.line ?? 0) + 1}: ${t(dict.validation.qtyExceeds, { n: e.available ?? 0 })}`,
      };
    }
    console.error("[accounting.verify]", e);
    return { ok: false, message: dict.common.errorToast };
  }
}

export async function rejectDocument(id: string, reason: string, checklistIn: Partial<Checklist>, notes: string): Promise<Result> {
  const user = await getSessionUser();
  const dict = getDict();
  const a = dict.accounting;
  if (!can(user.permissions, "accounting", "verify")) return { ok: false, message: dict.common.forbidden };
  const why = reason.trim();
  if (why.length < 3) return { ok: false, message: a.rejectReasonError };

  const doc = await prisma.document.findUnique({ where: { id }, select: { number: true, status: true, createdById: true } });
  if (!doc || doc.status !== "PENDING") return { ok: false, message: a.notPending };

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.document.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "REJECTED", verifiedById: user.id, verifiedAt: new Date() },
      });
      if (claimed.count === 0) throw new Error("NOT_PENDING");
      await tx.verification.create({
        data: {
          documentId: id,
          userId: user.id,
          result: "REJECTED",
          checklist: cleanChecklist(checklistIn),
          notes: notes.trim() || null,
          reason: why,
        },
      });
    });
    await audit(user, "rejected", "documents", { id, ref: doc.number }, { reason: why });
    if (doc.createdById !== user.id) {
      await notify({ type: "doc_rejected", docId: id, number: doc.number, actor: user.name, reason: why }, [doc.createdById]);
    }
    revalidate(id);
    return { ok: true, stockReference: null, nextId: await nextPending(id) };
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_PENDING") return { ok: false, message: a.notPending };
    console.error("[accounting.reject]", e);
    return { ok: false, message: dict.common.errorToast };
  }
}
