"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { getDict } from "@/i18n/server";
import { warehouseSchema, type ActionResult, type WarehouseInput } from "./schema";

function toData(v: WarehouseInput) {
  return {
    name: v.name,
    code: v.code,
    type: v.type,
    city: v.city || null,
    address: v.address || null,
    phone: v.phone || null,
    managerId: v.managerId || null,
    capacity: v.capacity ? Number(v.capacity) : null,
    status: v.status,
    notes: v.notes || null,
  };
}

/** Never leak raw DB errors to the UI. */
function friendly(e: unknown, dict: ReturnType<typeof getDict>): ActionResult {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    return { ok: false, message: dict.validation.fixErrors, errors: { code: dict.validation.codeExists } };
  }
  console.error("[warehouses]", e);
  return { ok: false, message: dict.common.errorToast };
}

async function parse(input: WarehouseInput) {
  const dict = getDict();
  const res = warehouseSchema(dict).safeParse(input);
  if (!res.success) {
    const errors: Partial<Record<keyof WarehouseInput, string>> = {};
    for (const i of res.error.issues) errors[i.path[0] as keyof WarehouseInput] ??= i.message;
    return { dict, error: { ok: false, message: dict.validation.fixErrors, errors } as ActionResult };
  }
  return { dict, data: res.data };
}

export async function createWarehouse(input: WarehouseInput): Promise<ActionResult> {
  const user = await getSessionUser();
  const { dict, data, error } = await parse(input);
  if (!can(user.permissions, "warehouses", "create")) return { ok: false, message: dict.common.forbidden };
  if (error) return error;
  try {
    const wh = await prisma.warehouse.create({ data: toData(data!) });
    await audit(user, "created", "warehouses", { id: wh.id, ref: wh.code });
    revalidatePath("/warehouses");
    revalidatePath("/");
    return { ok: true, id: wh.id };
  } catch (e) {
    return friendly(e, dict);
  }
}

export async function updateWarehouse(id: string, input: WarehouseInput): Promise<ActionResult> {
  const user = await getSessionUser();
  const { dict, data, error } = await parse(input);
  if (!can(user.permissions, "warehouses", "edit")) return { ok: false, message: dict.common.forbidden };
  if (error) return error;
  try {
    const before = await prisma.warehouse.findUniqueOrThrow({ where: { id } });
    const wh = await prisma.warehouse.update({ where: { id }, data: toData(data!) });
    const changed = Object.entries(toData(data!))
      .filter(([k, v]) => String(before[k as keyof typeof before] ?? "") !== String(v ?? ""))
      .map(([k]) => k);
    await audit(user, "edited", "warehouses", { id, ref: wh.code }, { changed });
    revalidatePath("/warehouses");
    revalidatePath(`/warehouses/${id}`);
    return { ok: true, id };
  } catch (e) {
    return friendly(e, dict);
  }
}

/** Hard delete only when nothing references the warehouse; otherwise archive. */
export async function deleteWarehouse(id: string): Promise<ActionResult> {
  const user = await getSessionUser();
  const dict = getDict();
  if (!can(user.permissions, "warehouses", "delete")) return { ok: false, message: dict.common.forbidden };
  const wh = await prisma.warehouse.findUnique({
    where: { id },
    include: { _count: { select: { stock: true, documents: true, movements: true } } },
  });
  if (!wh) return { ok: false, message: dict.common.errorToast };
  if (wh._count.stock + wh._count.documents + wh._count.movements > 0) {
    return { ok: false, message: dict.warehouses.deleteBlocked };
  }
  try {
    await prisma.warehouse.delete({ where: { id } });
    await audit(user, "deleted", "warehouses", { id, ref: wh.code });
    revalidatePath("/warehouses");
    revalidatePath("/");
    return { ok: true, id };
  } catch (e) {
    return friendly(e, dict);
  }
}

export async function archiveWarehouse(id: string): Promise<ActionResult> {
  const user = await getSessionUser();
  const dict = getDict();
  if (!can(user.permissions, "warehouses", "edit")) return { ok: false, message: dict.common.forbidden };
  const wh = await prisma.warehouse.update({ where: { id }, data: { status: "ARCHIVED" } });
  await audit(user, "archived", "warehouses", { id, ref: wh.code });
  revalidatePath("/warehouses");
  revalidatePath(`/warehouses/${id}`);
  return { ok: true, id };
}
