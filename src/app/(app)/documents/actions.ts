"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { notify, verifierIds } from "@/lib/notify";
import { formatMoney, getBaseCurrencyCode } from "@/lib/utils";
import { getDict } from "@/i18n/server";
import { interpolate as t } from "@/i18n/config";
import { canChangeDocument, DOC_TYPES, documentTotals, isEditable, isIncoming, lineTotals, needsSupplier, needsToWarehouse } from "@/lib/documents";
import type { DocInput, DocResult } from "./types";

const QTY = /^\d{1,11}(\.\d{1,3})?$/;
const MONEY = /^\d{1,12}(\.\d{1,2})?$/;
const PCT = /^\d{1,3}(\.\d{1,2})?$/;

async function nextNumber(tx: Prisma.TransactionClient) {
  const last = await tx.document.findFirst({ where: { number: { startsWith: "DOC-" } }, orderBy: { number: "desc" }, select: { number: true } });
  const n = last ? Number(last.number.slice(4)) || 0 : 0;
  return `DOC-${String(n + 1).padStart(6, "0")}`;
}

function revalidate(id?: string) {
  revalidatePath("/documents");
  if (id) revalidatePath(`/documents/${id}`);
  revalidatePath("/accounting");
  revalidatePath("/");
}

/** Validate + normalise. `strict` (submit) also requires items, supplier, etc. */
function check(input: DocInput, strict: boolean, dict: ReturnType<typeof getDict>) {
  const v = dict.validation;
  const d = dict.documents;
  const errors: Record<string, string> = {};

  if (!DOC_TYPES.includes(input.type)) errors.type = t(v.required, { field: d.type });
  const date = new Date(input.date);
  if (!input.date || Number.isNaN(+date)) errors.date = v.invalidDate;
  if (!input.warehouseId) errors.warehouseId = t(v.required, { field: d.warehouse });
  if (needsToWarehouse(input.type)) {
    if (!input.toWarehouseId) errors.toWarehouseId = t(v.required, { field: d.toWarehouse });
    else if (input.toWarehouseId === input.warehouseId) errors.toWarehouseId = v.sameWarehouse;
  }
  if (strict && needsSupplier(input.type) && !input.supplierId) errors.supplierId = v.supplierRequired;
  if (input.referenceNumber.length > 60) errors.referenceNumber = t(v.tooLong, { field: d.referenceNumber });
  if (!/^[A-Z]{3}$/.test(input.currency)) errors.currency = v.fixErrors;
  if (!(Number(input.exchangeRate) > 0)) errors.exchangeRate = v.invalidNumber;

  const incoming = isIncoming(input.type);
  const rows = input.lines.filter((l) => l.productId || l.quantity || l.unitPrice);
  if (strict && !rows.length) errors.lines = v.noItems;

  const lines = rows.map((l, i) => {
    const k = (f: string) => `${l.key}.${f}`;
    if (!l.productId) errors[k("productId")] = t(v.required, { field: d.product });
    if (!QTY.test(l.quantity.trim()) || Number(l.quantity) <= 0) errors[k("quantity")] = v.qtyPositive;
    if (!MONEY.test(l.unitPrice.trim())) errors[k("unitPrice")] = v.invalidPrice;
    if (l.discount && !MONEY.test(l.discount.trim())) errors[k("discount")] = v.invalidPrice;
    if (l.taxRate && (!PCT.test(l.taxRate) || Number(l.taxRate) > 100)) errors[k("taxRate")] = v.invalidPercent;
    let expiry: Date | null = null;
    if (incoming && l.expiryDate) {
      expiry = new Date(l.expiryDate);
      if (Number.isNaN(+expiry)) errors[k("expiryDate")] = v.invalidDate;
    }
    const amounts = {
      quantity: Number(l.quantity) || 0,
      unitPrice: Number(l.unitPrice) || 0,
      discount: Number(l.discount) || 0,
      taxRate: Number(l.taxRate) || 0,
    };
    if (amounts.discount > amounts.quantity * amounts.unitPrice + 0.001) errors[k("discount")] = v.discountTooHigh;
    return {
      position: i,
      productId: l.productId,
      batchId: incoming ? null : l.batchId || null,
      batchNumber: incoming ? l.batchNumber.trim() || null : null,
      expiryDate: expiry,
      ...amounts,
      lineTotal: lineTotals(amounts).net,
    };
  });

  return { errors, date, lines, totals: documentTotals(lines) };
}

export async function saveDocument(id: string | null, input: DocInput, submit: boolean): Promise<DocResult> {
  const user = await getSessionUser();
  const dict = getDict();
  const d = dict.documents;
  const perms = { edit: can(user.permissions, "documents", "edit"), create: can(user.permissions, "documents", "create") };
  if (!id && !perms.create) return { ok: false, message: dict.common.forbidden };

  if (id) {
    const existing = await prisma.document.findUnique({ where: { id }, select: { status: true, createdById: true } });
    if (!existing) return { ok: false, message: dict.common.errorToast };
    if (!isEditable(existing.status)) return { ok: false, message: d.notEditable };
    if (!canChangeDocument(perms, existing, user.id)) return { ok: false, message: dict.common.forbidden };
  }

  const { errors, date, lines, totals } = check(input, submit, dict);
  // currency must be the base currency or an active configured one
  const base = getBaseCurrencyCode();
  if (input.currency !== base && !(await prisma.currency.findFirst({ where: { code: input.currency, active: true } }))) {
    errors.currency = dict.validation.fixErrors;
  }
  if (Object.keys(errors).length) return { ok: false, message: errors.lines ?? dict.validation.fixErrors, errors };
  const rate = input.currency === base ? 1 : Number(input.exchangeRate);

  const header = {
    type: input.type,
    date,
    warehouseId: input.warehouseId,
    toWarehouseId: needsToWarehouse(input.type) ? input.toWarehouseId : null,
    supplierId: input.supplierId || null,
    referenceNumber: input.referenceNumber.trim() || null,
    notes: input.notes.trim() || null,
    ...totals,
    currency: input.currency,
    exchangeRate: rate,
    grandTotalBase: Math.round(totals.grandTotal * rate * 100) / 100,
    status: submit ? ("PENDING" as const) : ("DRAFT" as const),
    submittedAt: submit ? new Date() : null,
    // a corrected (previously rejected) document starts a fresh review
    verifiedById: null,
    verifiedAt: null,
  };

  try {
    const doc = await prisma.$transaction(async (tx) => {
      if (id) {
        await tx.documentItem.deleteMany({ where: { documentId: id } });
        return tx.document.update({ where: { id }, data: { ...header, items: { create: lines } } });
      }
      return tx.document.create({
        data: { ...header, number: await nextNumber(tx), createdById: user.id, items: { create: lines } },
      });
    });
    await audit(user, id ? "edited" : "created", "documents", { id: doc.id, ref: doc.number }, { submitted: submit });
    if (submit) {
      await notify(
        { type: "doc_submitted", docId: doc.id, number: doc.number, actor: user.name, docType: doc.type, total: formatMoney(doc.grandTotal, doc.currency) },
        await verifierIds(user.id),
      );
    }
    revalidate(doc.id);
    return { ok: true, id: doc.id, number: doc.number };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // number collision under concurrent creates — ask the user to retry
      return { ok: false, message: dict.common.errorToast };
    }
    console.error("[documents]", e);
    return { ok: false, message: dict.common.errorToast };
  }
}

/** Submit an existing draft from the details page (re-validates strictly). */
export async function submitDocument(id: string): Promise<DocResult> {
  const user = await getSessionUser();
  const dict = getDict();
  const doc = await prisma.document.findUnique({ where: { id }, include: { items: true } });
  if (!doc) return { ok: false, message: dict.common.errorToast };
  if (!isEditable(doc.status)) return { ok: false, message: dict.documents.notEditable };
  const perms = { edit: can(user.permissions, "documents", "edit"), create: can(user.permissions, "documents", "create") };
  if (!canChangeDocument(perms, doc, user.id)) return { ok: false, message: dict.common.forbidden };
  if (!doc.items.length) return { ok: false, message: dict.validation.noItems };
  if ((doc.type === "PURCHASE" || doc.type === "RETURN") && !doc.supplierId) return { ok: false, message: dict.validation.supplierRequired };
  await prisma.document.update({ where: { id }, data: { status: "PENDING", submittedAt: new Date(), verifiedById: null, verifiedAt: null } });
  await audit(user, "edited", "documents", { id, ref: doc.number }, { submitted: true });
  await notify(
    { type: "doc_submitted", docId: id, number: doc.number, actor: user.name, docType: doc.type, total: formatMoney(doc.grandTotal, doc.currency) },
    await verifierIds(user.id),
  );
  revalidate(id);
  return { ok: true, id, number: doc.number };
}

export async function deleteDocument(id: string): Promise<DocResult> {
  const user = await getSessionUser();
  const dict = getDict();
  const doc = await prisma.document.findUnique({ where: { id }, select: { status: true, number: true, createdById: true } });
  if (!doc) return { ok: false, message: dict.common.errorToast };
  if (!isEditable(doc.status)) return { ok: false, message: dict.documents.deleteOnlyDraft };
  const own = doc.createdById === user.id && can(user.permissions, "documents", "create");
  if (!can(user.permissions, "documents", "delete") && !own) return { ok: false, message: dict.common.forbidden };
  await prisma.document.delete({ where: { id } });
  await audit(user, "deleted", "documents", { id, ref: doc.number });
  revalidate();
  return { ok: true, id, number: doc.number };
}
