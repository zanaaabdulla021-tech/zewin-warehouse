import { z } from "zod";
import type { Dictionary } from "@/i18n/en";
import { interpolate as t } from "@/i18n/config";

export const WAREHOUSE_TYPES = ["MAIN", "BRANCH", "COLD_STORAGE", "TRANSIT"] as const;
export const WAREHOUSE_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;

/** Form values are kept as strings (what inputs produce); the server converts. */
export type WarehouseInput = {
  name: string;
  code: string;
  type: (typeof WAREHOUSE_TYPES)[number];
  city: string;
  address: string;
  phone: string;
  managerId: string;
  capacity: string;
  status: (typeof WAREHOUSE_STATUSES)[number];
  notes: string;
};

export const emptyWarehouse = (code = ""): WarehouseInput => ({
  name: "",
  code,
  type: "MAIN",
  city: "",
  address: "",
  phone: "",
  managerId: "",
  capacity: "",
  status: "ACTIVE",
  notes: "",
});

/** Schema with messages in the user's language — shared by client and server. */
export function warehouseSchema(dict: Dictionary) {
  const v = dict.validation;
  const w = dict.warehouses;
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, t(v.required, { field: w.name }))
      .max(120, t(v.tooLong, { field: w.name })),
    code: z
      .string()
      .trim()
      .min(1, t(v.required, { field: w.code }))
      .max(20, t(v.tooLong, { field: w.code }))
      .regex(/^[A-Za-z0-9-]+$/, v.codeFormat)
      .transform((s) => s.toUpperCase()),
    type: z.enum(WAREHOUSE_TYPES),
    city: z.string().trim().max(80, t(v.tooLong, { field: w.city })),
    address: z.string().trim().max(250, t(v.tooLong, { field: w.address })),
    phone: z
      .string()
      .trim()
      .refine((s) => s === "" || /^\+?[0-9\s-]{7,20}$/.test(s), v.invalidPhone),
    managerId: z.string(),
    capacity: z
      .string()
      .trim()
      .refine((s) => s === "" || (/^\d+$/.test(s) && Number(s) <= 10_000_000), v.invalidNumber),
    status: z.enum(WAREHOUSE_STATUSES),
    notes: z.string().max(2000, t(v.tooLong, { field: dict.common.notes })),
  }) as unknown as z.ZodType<WarehouseInput>;
}

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; message: string; errors?: Partial<Record<keyof WarehouseInput, string>> };
