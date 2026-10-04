import { z } from "zod";
import type { Dictionary } from "@/i18n/en";
import { interpolate as t } from "@/i18n/config";

export const PRODUCT_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;

export type ProductInput = {
  name: string;
  code: string;
  barcode: string;
  categoryId: string;
  unitId: string;
  purchasePrice: string;
  sellingPrice: string;
  taxRate: string;
  discountRate: string;
  minQuantity: string;
  tracksBatch: boolean;
  tracksExpiry: boolean;
  description: string;
  imageUrl: string;
  notes: string;
  status: (typeof PRODUCT_STATUSES)[number];
};

export const emptyProduct = (code = ""): ProductInput => ({
  name: "",
  code,
  barcode: "",
  categoryId: "",
  unitId: "",
  purchasePrice: "",
  sellingPrice: "",
  taxRate: "0",
  discountRate: "0",
  minQuantity: "0",
  tracksBatch: true,
  tracksExpiry: true,
  description: "",
  imageUrl: "",
  notes: "",
  status: "ACTIVE",
});

const money = /^\d{1,12}(\.\d{1,2})?$/;
const qty = /^\d{1,11}(\.\d{1,3})?$/;

export function productSchema(dict: Dictionary) {
  const v = dict.validation;
  const p = dict.products;
  return z.object({
    name: z.string().trim().min(1, t(v.required, { field: p.name })).max(160, t(v.tooLong, { field: p.name })),
    code: z
      .string()
      .trim()
      .min(1, t(v.required, { field: p.code }))
      .max(30, t(v.tooLong, { field: p.code }))
      .regex(/^[A-Za-z0-9-]+$/, v.codeFormat)
      .transform((s) => s.toUpperCase()),
    barcode: z.string().trim().max(64, t(v.tooLong, { field: p.barcode })),
    categoryId: z.string(),
    unitId: z.string().min(1, t(v.required, { field: p.unit })),
    purchasePrice: z.string().trim().min(1, t(v.required, { field: p.purchasePrice })).regex(money, v.invalidPrice),
    sellingPrice: z.string().trim().min(1, t(v.required, { field: p.sellingPrice })).regex(money, v.invalidPrice),
    taxRate: z.string().trim().refine((s) => s === "" || (/^\d+(\.\d{1,2})?$/.test(s) && Number(s) <= 100), v.invalidPercent),
    discountRate: z.string().trim().refine((s) => s === "" || (/^\d+(\.\d{1,2})?$/.test(s) && Number(s) <= 100), v.invalidPercent),
    minQuantity: z.string().trim().refine((s) => s === "" || qty.test(s), v.invalidQuantity),
    tracksBatch: z.boolean(),
    tracksExpiry: z.boolean(),
    description: z.string().max(2000, t(v.tooLong, { field: p.description })),
    imageUrl: z.string().trim().refine((s) => s === "" || /^https?:\/\/\S+$/i.test(s), v.invalidUrl),
    notes: z.string().max(2000, t(v.tooLong, { field: dict.common.notes })),
    status: z.enum(PRODUCT_STATUSES),
  }) as unknown as z.ZodType<ProductInput>;
}

export type ProductResult =
  | { ok: true; id: string }
  | { ok: false; message: string; errors?: Partial<Record<keyof ProductInput, string>> };
