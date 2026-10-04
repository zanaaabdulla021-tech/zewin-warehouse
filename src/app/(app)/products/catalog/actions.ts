"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { getDict } from "@/i18n/server";
import { interpolate as t } from "@/i18n/config";

type Result = { ok: true } | { ok: false; message: string; errors?: Record<string, string> };

async function guard() {
  const user = await getSessionUser();
  const dict = getDict();
  return { user, dict, allowed: can(user.permissions, "products", "edit") };
}

function done() {
  revalidatePath("/products/catalog");
  revalidatePath("/products");
}

export async function saveCategory(id: string | null, input: { name: string; parentId: string }): Promise<Result> {
  const { user, dict, allowed } = await guard();
  if (!allowed) return { ok: false, message: dict.common.forbidden };
  const name = input.name.trim();
  if (!name) return { ok: false, message: dict.validation.fixErrors, errors: { name: t(dict.validation.required, { field: dict.catalog.categoryName }) } };
  if (name.length > 80) return { ok: false, message: dict.validation.fixErrors, errors: { name: t(dict.validation.tooLong, { field: dict.catalog.categoryName }) } };
  const parentId = input.parentId && input.parentId !== id ? input.parentId : null;
  try {
    const c = id
      ? await prisma.category.update({ where: { id }, data: { name, parentId } })
      : await prisma.category.create({ data: { name, parentId } });
    await audit(user, id ? "edited" : "created", "products", { id: c.id, ref: c.name }, { kind: "category" });
    done();
    return { ok: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, message: dict.validation.fixErrors, errors: { name: dict.validation.nameExists } };
    }
    console.error("[catalog]", e);
    return { ok: false, message: dict.common.errorToast };
  }
}

export async function deleteCategory(id: string): Promise<Result> {
  const { user, dict, allowed } = await guard();
  if (!allowed) return { ok: false, message: dict.common.forbidden };
  const c = await prisma.category.findUnique({ where: { id }, include: { _count: { select: { products: true } } } });
  if (!c) return { ok: false, message: dict.common.errorToast };
  if (c._count.products > 0) return { ok: false, message: t(dict.catalog.inUse, { n: c._count.products }) };
  await prisma.$transaction([
    prisma.category.updateMany({ where: { parentId: id }, data: { parentId: c.parentId } }),
    prisma.category.delete({ where: { id } }),
  ]);
  await audit(user, "deleted", "products", { id, ref: c.name }, { kind: "category" });
  done();
  return { ok: true };
}

export async function saveUnit(id: string | null, input: { name: string; symbol: string }): Promise<Result> {
  const { user, dict, allowed } = await guard();
  if (!allowed) return { ok: false, message: dict.common.forbidden };
  const name = input.name.trim();
  const symbol = input.symbol.trim();
  const errors: Record<string, string> = {};
  if (!name) errors.name = t(dict.validation.required, { field: dict.catalog.unitName });
  if (!symbol) errors.symbol = t(dict.validation.required, { field: dict.catalog.symbol });
  else if (symbol.length > 10) errors.symbol = t(dict.validation.tooLong, { field: dict.catalog.symbol });
  if (Object.keys(errors).length) return { ok: false, message: dict.validation.fixErrors, errors };
  try {
    const u = id
      ? await prisma.unit.update({ where: { id }, data: { name, symbol } })
      : await prisma.unit.create({ data: { name, symbol } });
    await audit(user, id ? "edited" : "created", "products", { id: u.id, ref: u.name }, { kind: "unit" });
    done();
    return { ok: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, message: dict.validation.fixErrors, errors: { name: dict.validation.nameExists } };
    }
    console.error("[catalog]", e);
    return { ok: false, message: dict.common.errorToast };
  }
}

export async function deleteUnit(id: string): Promise<Result> {
  const { user, dict, allowed } = await guard();
  if (!allowed) return { ok: false, message: dict.common.forbidden };
  const u = await prisma.unit.findUnique({ where: { id }, include: { _count: { select: { products: true } } } });
  if (!u) return { ok: false, message: dict.common.errorToast };
  if (u._count.products > 0) return { ok: false, message: t(dict.catalog.inUse, { n: u._count.products }) };
  await prisma.unit.delete({ where: { id } });
  await audit(user, "deleted", "products", { id, ref: u.name }, { kind: "unit" });
  done();
  return { ok: true };
}
