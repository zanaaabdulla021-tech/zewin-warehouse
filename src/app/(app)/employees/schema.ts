import { z } from "zod";
import type { Dictionary } from "@/i18n/en";
import { interpolate as t } from "@/i18n/config";

export type EmployeeInput = {
  name: string;
  email: string;
  phone: string;
  roleId: string;
  password: string;
  warehouseIds: string[];
  status: "ACTIVE" | "INACTIVE";
};

export function employeeSchema(dict: Dictionary, creating: boolean) {
  const v = dict.validation;
  const e = dict.employees;
  return z.object({
    name: z.string().trim().min(1, t(v.required, { field: e.name })).max(120, t(v.tooLong, { field: e.name })),
    email: z
      .string()
      .trim()
      .min(1, t(v.required, { field: e.email }))
      .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, v.invalidEmail)
      .transform((x) => x.toLowerCase()),
    phone: z.string().trim().refine((x) => x === "" || /^\+?[0-9\s-]{7,20}$/.test(x), v.invalidPhone),
    roleId: z.string().min(1, t(v.required, { field: e.role })),
    password: creating
      ? z.string().min(8, v.passwordShort).max(100)
      : z.string().refine((x) => x === "" || x.length >= 8, v.passwordShort),
    warehouseIds: z.array(z.string()),
    status: z.enum(["ACTIVE", "INACTIVE"]),
  }) as unknown as z.ZodType<EmployeeInput>;
}

export type EmployeeResult =
  | { ok: true; id: string }
  | { ok: false; message: string; errors?: Partial<Record<keyof EmployeeInput, string>> };
