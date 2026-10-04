/**
 * Document rules shared by client (live totals) and server (authoritative totals).
 */

export const DOC_TYPES = ["PURCHASE", "TRANSFER", "STOCK_IN", "STOCK_OUT", "RETURN", "OTHER"] as const;
export type DocType = (typeof DOC_TYPES)[number];

/** How each document type moves stock once it is verified. */
export const DOC_STOCK_EFFECT: Record<DocType, "IN" | "OUT" | "TRANSFER" | "NONE"> = {
  PURCHASE: "IN",
  STOCK_IN: "IN",
  TRANSFER: "TRANSFER",
  STOCK_OUT: "OUT",
  RETURN: "OUT", // returned to supplier
  OTHER: "NONE",
};

export const needsSupplier = (t: DocType) => t === "PURCHASE" || t === "RETURN";
export const needsToWarehouse = (t: DocType) => t === "TRANSFER";
/** new batch numbers are entered for incoming stock; outgoing picks existing batches */
export const isIncoming = (t: DocType) => DOC_STOCK_EFFECT[t] === "IN" || DOC_STOCK_EFFECT[t] === "NONE";

export const EDITABLE_STATUSES = ["DRAFT", "REJECTED"] as const;
export const isEditable = (status: string) => (EDITABLE_STATUSES as readonly string[]).includes(status);

/**
 * Who may change a draft/rejected document: anyone with documents.edit,
 * or the person who created it (if they can create documents) — so a warehouse
 * employee can fix and resubmit a document accounting rejected.
 */
export function canChangeDocument(
  perms: { edit: boolean; create: boolean },
  doc: { createdById: string; status: string },
  userId: string,
) {
  return isEditable(doc.status) && (perms.edit || (perms.create && doc.createdById === userId));
}

export type LineAmounts = { quantity: number; unitPrice: number; discount: number; taxRate: number };

const r2 = (n: number) => Math.round(n * 100) / 100;

export function lineTotals(l: LineAmounts) {
  const gross = r2(l.quantity * l.unitPrice);
  const discount = r2(Math.min(Math.max(l.discount, 0), gross));
  const net = r2(gross - discount);
  const tax = r2((net * l.taxRate) / 100);
  return { gross, discount, net, tax };
}

export function documentTotals(lines: LineAmounts[]) {
  let subtotal = 0,
    discountTotal = 0,
    taxTotal = 0;
  for (const l of lines) {
    const t = lineTotals(l);
    subtotal += t.gross;
    discountTotal += t.discount;
    taxTotal += t.tax;
  }
  subtotal = r2(subtotal);
  discountTotal = r2(discountTotal);
  taxTotal = r2(taxTotal);
  return { subtotal, discountTotal, taxTotal, grandTotal: r2(subtotal - discountTotal + taxTotal) };
}
