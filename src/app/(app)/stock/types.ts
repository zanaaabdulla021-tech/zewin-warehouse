import type { StockOpType } from "@/lib/stock";

export type { StockOpType };

/** What the client form sends (all strings, as inputs produce them). */
export type StockLineInput = {
  key: string;
  productId: string;
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  quantity: string;
  unitCost: string;
};

export type StockOpInput = {
  type: StockOpType;
  warehouseId: string;
  toWarehouseId: string;
  date: string;
  note: string;
  lines: StockLineInput[];
};

export type StockOpResult =
  | { ok: true; reference: string }
  | { ok: false; message: string; errors?: Record<string, string> };

/** Lookup data the form needs (kept small: only what's selectable). */
export type FormProduct = {
  id: string;
  name: string;
  code: string;
  barcode: string | null;
  unit: string;
  cost: number;
  tracksBatch: boolean;
  tracksExpiry: boolean;
};
export type FormLevel = {
  warehouseId: string;
  productId: string;
  batchId: string | null;
  batchNumber: string | null;
  expiryDate: string | null;
  quantity: number;
};
