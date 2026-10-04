import "server-only";
import ExcelJS from "exceljs";
import { prisma } from "./prisma";
import type { Dictionary } from "@/i18n/en";

/** Column headers of the template (English, fixed — the parser matches on these). */
export const IMPORT_COLUMNS = [
  { key: "warehouseCode", header: "Warehouse Code", width: 16 },
  { key: "productCode", header: "Product Code", width: 16 },
  { key: "productName", header: "Product Name", width: 32 },
  { key: "unit", header: "Unit", width: 10 },
  { key: "batch", header: "Batch", width: 16 },
  { key: "expiry", header: "Expiry (YYYY-MM-DD)", width: 20 },
  { key: "quantity", header: "Quantity", width: 12 },
  { key: "unitCost", header: "Unit Cost", width: 12 },
] as const;
type ColKey = (typeof IMPORT_COLUMNS)[number]["key"];

export const MAX_IMPORT_ROWS = 5000;

export type ImportRow = {
  row: number;
  warehouseCode: string;
  productCode: string;
  productName: string;
  unit: string;
  batch: string;
  expiry: string | null; // YYYY-MM-DD
  quantity: number | null;
  unitCost: number | null;
  /** resolved ids (server only) */
  warehouseId?: string;
  productId?: string;
  isNewProduct: boolean;
  errors: string[];
};

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("result" in v && v.result !== undefined) return cellText(v.result as ExcelJS.CellValue);
    if ("text" in v && typeof v.text === "string") return v.text;
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
  }
  return String(v).trim();
}

function toNumber(s: string): number | null {
  if (s === "") return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

/** Build a UTC date only if day/month/year form a real calendar date (no 31/13 roll-over). */
function ymd(y: number, m: number, d: number): string | "invalid" {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2200) return "invalid";
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return "invalid";
  return dt.toISOString().slice(0, 10);
}

function toDate(s: string): string | null | "invalid" {
  if (!s) return null;
  // Excel serial numbers (days since 1899-12-30)
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const d = new Date(Math.round((Number(s) - 25569) * 86400000));
    return d.toISOString().slice(0, 10);
  }
  const m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/); // YYYY-MM-DD
  if (m) return ymd(+m[1]!, +m[2]!, +m[3]!);
  const m2 = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/); // DD/MM/YYYY
  if (m2) return ymd(+m2[3]!, +m2[2]!, +m2[1]!);
  return "invalid";
}

/** Read the uploaded workbook into raw rows. Throws on unreadable files. */
export async function readWorkbook(buf: ArrayBuffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("no sheet");
  // map headers → column numbers (case/space insensitive, so small edits to the header are fine)
  const norm = (s: string) => s.toLowerCase().replace(/\(.*\)/, "").replace(/[^a-z]/g, "");
  const colOf = new Map<ColKey, number>();
  ws.getRow(1).eachCell((cell, col) => {
    const h = norm(cellText(cell.value));
    const match = IMPORT_COLUMNS.find((c) => norm(c.header) === h);
    if (match) colOf.set(match.key, col);
  });
  if (!colOf.has("warehouseCode") || !colOf.has("productCode") || !colOf.has("quantity")) throw new Error("headers");

  const raw: { row: number; v: Record<ColKey, string> }[] = [];
  ws.eachRow({ includeEmpty: false }, (r, n) => {
    if (n === 1) return;
    const v = Object.fromEntries(IMPORT_COLUMNS.map((c) => [c.key, colOf.has(c.key) ? cellText(r.getCell(colOf.get(c.key)!).value) : ""])) as Record<ColKey, string>;
    if (Object.values(v).every((x) => !x)) return;
    raw.push({ row: n, v });
  });
  return raw;
}

/**
 * Validate rows against the database. With `createMissing`, unknown product codes
 * that have a name become new products (created on commit).
 */
export async function validateImport(raw: { row: number; v: Record<ColKey, string> }[], createMissing: boolean, dict: Dictionary) {
  const e = dict.importer.errors;
  const [warehouses, products] = await Promise.all([
    prisma.warehouse.findMany({ where: { status: { not: "ARCHIVED" } }, select: { id: true, code: true } }),
    prisma.product.findMany({ select: { id: true, code: true, tracksBatch: true, purchasePrice: true } }),
  ]);
  const wh = new Map(warehouses.map((w) => [w.code.toUpperCase(), w.id]));
  const pr = new Map(products.map((p) => [p.code.toUpperCase(), p]));
  const seen = new Set<string>();

  return raw.map(({ row, v }) => {
    const errors: string[] = [];
    const warehouseCode = v.warehouseCode.toUpperCase();
    const productCode = v.productCode.toUpperCase();
    const warehouseId = wh.get(warehouseCode);
    if (!warehouseId) errors.push(e.warehouse);

    const product = pr.get(productCode);
    let isNewProduct = false;
    if (!product) {
      if (!createMissing || !productCode) errors.push(e.product);
      else if (!v.productName) errors.push(e.productName);
      else isNewProduct = true;
    }

    const quantity = toNumber(v.quantity);
    if (quantity === null || Number.isNaN(quantity) || quantity <= 0) errors.push(e.qty);
    const unitCost = toNumber(v.unitCost);
    if (unitCost !== null && (Number.isNaN(unitCost) || unitCost < 0)) errors.push(e.cost);
    const expiry = toDate(v.expiry);
    if (expiry === "invalid") errors.push(e.expiry);
    if (product?.tracksBatch && !v.batch) errors.push(e.batch);

    const dupKey = `${warehouseCode}|${productCode}|${v.batch.toUpperCase()}`;
    if (seen.has(dupKey)) errors.push(e.duplicate);
    seen.add(dupKey);

    return {
      row,
      warehouseCode,
      productCode,
      productName: v.productName,
      unit: v.unit,
      batch: v.batch,
      expiry: expiry === "invalid" ? null : expiry,
      quantity: quantity === null || Number.isNaN(quantity) ? null : quantity,
      unitCost: unitCost === null || Number.isNaN(unitCost) ? (product ? Number(product.purchasePrice) : null) : unitCost,
      warehouseId,
      productId: product?.id,
      isNewProduct,
      errors,
    } satisfies ImportRow;
  });
}

/** Build the template workbook: data sheet with examples + a reference sheet of codes. */
export async function buildTemplate() {
  const [warehouses, products] = await Promise.all([
    prisma.warehouse.findMany({ where: { status: "ACTIVE" }, orderBy: { code: "asc" }, select: { code: true, name: true } }),
    prisma.product.findMany({ where: { status: "ACTIVE" }, orderBy: { code: "asc" }, select: { code: true, name: true, unit: { select: { symbol: true } } } }),
  ]);
  const wb = new ExcelJS.Workbook();
  wb.creator = "ZEWIN";
  const ws = wb.addWorksheet("Opening balance", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = IMPORT_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A8873" } };
  head.height = 22;
  const w0 = warehouses[0]?.code ?? "WH-001";
  const p0 = products[0];
  const p1 = products[1];
  if (p0) ws.addRow({ warehouseCode: w0, productCode: p0.code, productName: p0.name, unit: p0.unit?.symbol ?? "", batch: "B-0001", expiry: "2027-12-31", quantity: 100, unitCost: 1.25 });
  if (p1) ws.addRow({ warehouseCode: w0, productCode: p1.code, productName: p1.name, unit: p1.unit?.symbol ?? "", batch: "B-0002", expiry: "2028-06-30", quantity: 40, unitCost: 3.5 });
  ws.addRow({ warehouseCode: w0, productCode: "NEW-001", productName: "Example new product", unit: "box", batch: "N-01", expiry: "2028-01-31", quantity: 25, unitCost: 2 });
  for (let r = 2; r <= ws.rowCount; r++) ws.getRow(r).font = { color: { argb: "FF6B7A82" }, italic: true };

  const ref = wb.addWorksheet("Codes");
  ref.columns = [
    { header: "Warehouse Code", key: "wc", width: 16 },
    { header: "Warehouse", key: "wn", width: 30 },
    { header: "", key: "gap", width: 4 },
    { header: "Product Code", key: "pc", width: 16 },
    { header: "Product", key: "pn", width: 36 },
    { header: "Unit", key: "pu", width: 10 },
  ];
  ref.getRow(1).font = { bold: true };
  const n = Math.max(warehouses.length, products.length);
  for (let i = 0; i < n; i++) {
    ref.addRow({ wc: warehouses[i]?.code, wn: warehouses[i]?.name, pc: products[i]?.code, pn: products[i]?.name, pu: products[i]?.unit?.symbol });
  }
  return wb.xlsx.writeBuffer();
}
