"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { getDict } from "@/i18n/server";
import { productSchema, type ProductInput, type ProductResult } from "./schema";

function toData(v: ProductInput) {
  return {
    name: v.name,
    code: v.code,
    barcode: v.barcode || null,
    categoryId: v.categoryId || null,
    unitId: v.unitId || null,
    purchasePrice: new Prisma.Decimal(v.purchasePrice || 0),
    sellingPrice: new Prisma.Decimal(v.sellingPrice || 0),
    taxRate: new Prisma.Decimal(v.taxRate || 0),
    discountRate: new Prisma.Decimal(v.discountRate || 0),
    minQuantity: new Prisma.Decimal(v.minQuantity || 0),
    tracksBatch: v.tracksBatch,
    tracksExpiry: v.tracksExpiry,
    description: v.description || null,
    imageUrl: v.imageUrl || null,
    notes: v.notes || null,
    status: v.status,
  };
}

function friendly(e: unknown, dict: ReturnType<typeof getDict>): ProductResult {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    const target = String((e.meta?.target as string[] | string | undefined) ?? "");
    const errors = target.includes("barcode") ? { barcode: dict.validation.barcodeExists } : { code: dict.validation.productCodeExists };
    return { ok: false, message: dict.validation.fixErrors, errors };
  }
  console.error("[products]", e);
  return { ok: false, message: dict.common.errorToast };
}

function parse(input: ProductInput) {
  const dict = getDict();
  const res = productSchema(dict).safeParse(input);
  if (res.success) return { dict, data: res.data };
  const errors: Partial<Record<keyof ProductInput, string>> = {};
  for (const i of res.error.issues) errors[i.path[0] as keyof ProductInput] ??= i.message;
  return { dict, error: { ok: false, message: dict.validation.fixErrors, errors } as ProductResult };
}

export async function createProduct(input: ProductInput): Promise<ProductResult> {
  const user = await getSessionUser();
  const { dict, data, error } = parse(input);
  if (!can(user.permissions, "products", "create")) return { ok: false, message: dict.common.forbidden };
  if (error) return error;
  try {
    const p = await prisma.product.create({ data: toData(data!) });
    await audit(user, "created", "products", { id: p.id, ref: p.code });
    revalidatePath("/products");
    revalidatePath("/");
    return { ok: true, id: p.id };
  } catch (e) {
    return friendly(e, dict);
  }
}

export async function updateProduct(id: string, input: ProductInput): Promise<ProductResult> {
  const user = await getSessionUser();
  const { dict, data, error } = parse(input);
  if (!can(user.permissions, "products", "edit")) return { ok: false, message: dict.common.forbidden };
  if (error) return error;
  try {
    const p = await prisma.product.update({ where: { id }, data: toData(data!) });
    await audit(user, "edited", "products", { id, ref: p.code });
    revalidatePath("/products");
    revalidatePath(`/products/${id}`);
    revalidatePath("/");
    return { ok: true, id };
  } catch (e) {
    return friendly(e, dict);
  }
}

export async function archiveProduct(id: string): Promise<ProductResult> {
  const user = await getSessionUser();
  const dict = getDict();
  if (!can(user.permissions, "products", "edit")) return { ok: false, message: dict.common.forbidden };
  const p = await prisma.product.update({ where: { id }, data: { status: "ARCHIVED" } });
  await audit(user, "archived", "products", { id, ref: p.code });
  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  return { ok: true, id };
}

export async function deleteProduct(id: string): Promise<ProductResult> {
  const user = await getSessionUser();
  const dict = getDict();
  if (!can(user.permissions, "products", "delete")) return { ok: false, message: dict.common.forbidden };
  const p = await prisma.product.findUnique({
    where: { id },
    include: { _count: { select: { stock: true, movements: true, docItems: true } } },
  });
  if (!p) return { ok: false, message: dict.common.errorToast };
  if (p._count.stock + p._count.movements + p._count.docItems > 0) return { ok: false, message: dict.products.deleteBlocked };
  try {
    await prisma.product.delete({ where: { id } });
    await audit(user, "deleted", "products", { id, ref: p.code });
    revalidatePath("/products");
    return { ok: true, id };
  } catch (e) {
    return friendly(e, dict);
  }
}
