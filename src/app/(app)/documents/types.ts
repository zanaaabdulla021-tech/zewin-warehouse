import type { DocType } from "@/lib/documents";

export type DocLineInput = {
  key: string;
  productId: string;
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  taxRate: string;
};

export type DocInput = {
  type: DocType;
  date: string;
  warehouseId: string;
  toWarehouseId: string;
  supplierId: string;
  referenceNumber: string;
  notes: string;
  currency: string;
  exchangeRate: string;
  lines: DocLineInput[];
};

export type DocResult =
  | { ok: true; id: string; number: string }
  | { ok: false; message: string; errors?: Record<string, string> };
