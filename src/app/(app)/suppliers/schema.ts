import { z } from "zod";
import type { Dictionary } from "@/i18n/en";
import { interpolate as t } from "@/i18n/config";

export const SUPPLIER_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;

export type SupplierInput = {
  name: string;
  code: string;
  contactName: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  taxNumber: string;
  notes: string;
  status: (typeof SUPPLIER_STATUSES)[number];
};

export const emptySupplier = (code = ""): SupplierInput => ({
  name: "",
  code,
  contactName: "",
  phone: "",
  email: "",
  city: "",
  address: "",
  taxNumber: "",
  notes: "",
  status: "ACTIVE",
});

export function supplierSchema(dict: Dictionary) {
  const v = dict.validation;
  const s = dict.suppliers;
  const max = (n: number, field: string) => z.string().trim().max(n, t(v.tooLong, { field }));
  return z.object({
    name: z.string().trim().min(1, t(v.required, { field: s.name })).max(160, t(v.tooLong, { field: s.name })),
    code: z
      .string()
      .trim()
      .min(1, t(v.required, { field: s.code }))
      .max(20, t(v.tooLong, { field: s.code }))
      .regex(/^[A-Za-z0-9-]+$/, v.codeFormat)
      .transform((x) => x.toUpperCase()),
    contactName: max(120, s.contactName),
    phone: z.string().trim().refine((x) => x === "" || /^\+?[0-9\s-]{7,20}$/.test(x), v.invalidPhone),
    email: z.string().trim().refine((x) => x === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x), v.invalidEmail),
    city: max(80, s.city),
    address: max(250, s.address),
    taxNumber: max(40, s.taxNumber),
    notes: max(2000, dict.common.notes),
    status: z.enum(SUPPLIER_STATUSES),
  }) as unknown as z.ZodType<SupplierInput>;
}

export type SupplierResult =
  | { ok: true; id: string }
  | { ok: false; message: string; errors?: Partial<Record<keyof SupplierInput, string>> };
