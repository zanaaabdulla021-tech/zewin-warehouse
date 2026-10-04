"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { getDict } from "@/i18n/server";
import { supplierSchema, type SupplierInput, type SupplierResult } from "./schema";

const data = (v: SupplierInput) => ({
  name: v.name,
  code: v.code,
  contactName: v.contactName || null,
  phone: v.phone || null,
  email: v.email || null,
  city: v.city || null,
  address: v.address || null,
  taxNumber: v.taxNumber || null,
  notes: v.notes || null,
  status: v.status,
});

function parse(input: SupplierInput) {
  const dict = getDict();
  const res = supplierSchema(dict).safeParse(input);
  if (res.success) return { dict, value: res.data };
  const errors: Partial<Record<keyof SupplierInput, string>> = {};
  for (const i of res.error.issues) errors[i.path[0] as keyof SupplierInput] ??= i.message;
  return { dict, error: { ok: false, message: dict.validation.fixErrors, errors } as SupplierResult };
}

function friendly(e: unknown, dict: ReturnType<typeof getDict>): SupplierResult {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    return { ok: false, message: dict.validation.fixErrors, errors: { code: dict.validation.supplierCodeExists } };
  }
  console.error("[suppliers]", e);
  return { ok: false, message: dict.common.errorToast };
}

export async function saveSupplier(id: string | null, input: SupplierInput): Promise<SupplierResult> {
  const user = await getSessionUser();
  const { dict, value, error } = parse(input);
  if (!can(user.permissions, "suppliers", id ? "edit" : "create")) return { ok: false, message: dict.common.forbidden };
  if (error) return error;
  try {
    const s = id
      ? await prisma.supplier.update({ where: { id }, data: data(value!) })
      : await prisma.supplier.create({ data: data(value!) });
    await audit(user, id ? "edited" : "created", "suppliers", { id: s.id, ref: s.code });
    revalidatePath("/suppliers", "layout");
    return { ok: true, id: s.id };
  } catch (e) {
    return friendly(e, dict);
  }
}

export async function archiveSupplier(id: string): Promise<SupplierResult> {
  const user = await getSessionUser();
  const dict = getDict();
  if (!can(user.permissions, "suppliers", "edit")) return { ok: false, message: dict.common.forbidden };
  const s = await prisma.supplier.update({ where: { id }, data: { status: "ARCHIVED" } });
  await audit(user, "archived", "suppliers", { id, ref: s.code });
  revalidatePath("/suppliers", "layout");
  return { ok: true, id };
}

export async function deleteSupplier(id: string): Promise<SupplierResult> {
  const user = await getSessionUser();
  const dict = getDict();
  if (!can(user.permissions, "suppliers", "delete")) return { ok: false, message: dict.common.forbidden };
  const s = await prisma.supplier.findUnique({ where: { id }, include: { _count: { select: { documents: true } } } });
  if (!s) return { ok: false, message: dict.common.errorToast };
  if (s._count.documents > 0) return { ok: false, message: dict.suppliers.deleteBlocked };
  await prisma.supplier.delete({ where: { id } });
  await audit(user, "deleted", "suppliers", { id, ref: s.code });
  revalidatePath("/suppliers", "layout");
  return { ok: true, id };
}
