"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { ACTIONS, MODULES, can, type Action, type Module } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { getDict } from "@/i18n/server";
import { interpolate as t } from "@/i18n/config";
import { employeeSchema, type EmployeeInput, type EmployeeResult } from "./schema";

/** Would this change leave the system without an active Super Admin? */
async function wouldOrphanSuperAdmin(targetId: string, nextRoleId: string, nextActive: boolean) {
  const target = await prisma.user.findUnique({ where: { id: targetId }, include: { role: true } });
  if (!target || target.role.key !== "SUPER_ADMIN" || target.status !== "ACTIVE") return false;
  const nextRole = await prisma.role.findUnique({ where: { id: nextRoleId } });
  if (nextRole?.key === "SUPER_ADMIN" && nextActive) return false;
  const others = await prisma.user.count({ where: { id: { not: targetId }, status: "ACTIVE", role: { key: "SUPER_ADMIN" } } });
  return others === 0;
}

function revalidate() {
  revalidatePath("/employees", "layout");
  revalidatePath("/warehouses", "layout");
}

export async function saveEmployee(id: string | null, input: EmployeeInput): Promise<EmployeeResult> {
  const me = await getSessionUser();
  const dict = getDict();
  const e = dict.employees;
  if (!can(me.permissions, "employees", id ? "edit" : "create")) return { ok: false, message: dict.common.forbidden };

  const res = employeeSchema(dict, !id).safeParse(input);
  if (!res.success) {
    const errors: Partial<Record<keyof EmployeeInput, string>> = {};
    for (const i of res.error.issues) errors[i.path[0] as keyof EmployeeInput] ??= i.message;
    return { ok: false, message: dict.validation.fixErrors, errors };
  }
  const v = res.data;

  const role = await prisma.role.findUnique({ where: { id: v.roleId } });
  if (!role) return { ok: false, message: dict.validation.fixErrors, errors: { roleId: t(dict.validation.required, { field: e.role }) } };
  // only a Super Admin can create or promote Super Admins
  if (role.key === "SUPER_ADMIN" && me.role.key !== "SUPER_ADMIN") return { ok: false, message: dict.common.forbidden };

  if (id) {
    const current = await prisma.user.findUnique({ where: { id }, select: { roleId: true, role: { select: { key: true } } } });
    if (!current) return { ok: false, message: dict.common.errorToast };
    if (current.role.key === "SUPER_ADMIN" && me.role.key !== "SUPER_ADMIN") return { ok: false, message: dict.common.forbidden };
    if (id === me.id && (current.roleId !== v.roleId || v.status !== "ACTIVE")) return { ok: false, message: e.cannotSelf };
    if (await wouldOrphanSuperAdmin(id, v.roleId, v.status === "ACTIVE")) return { ok: false, message: e.lastSuperAdmin };
  }

  const base = { name: v.name, email: v.email, phone: v.phone || null, roleId: v.roleId, status: v.status };
  try {
    const user = await prisma.$transaction(async (tx) => {
      const u = id
        ? await tx.user.update({
            where: { id },
            data: { ...base, ...(v.password ? { passwordHash: await bcrypt.hash(v.password, 10) } : {}) },
          })
        : await tx.user.create({ data: { ...base, passwordHash: await bcrypt.hash(v.password, 10) } });
      await tx.warehouseEmployee.deleteMany({ where: { userId: u.id, warehouseId: { notIn: v.warehouseIds } } });
      const existing = await tx.warehouseEmployee.findMany({ where: { userId: u.id }, select: { warehouseId: true } });
      const have = new Set(existing.map((x) => x.warehouseId));
      const add = v.warehouseIds.filter((w) => !have.has(w));
      if (add.length) await tx.warehouseEmployee.createMany({ data: add.map((warehouseId) => ({ warehouseId, userId: u.id })) });
      return u;
    });
    await audit(me, id ? "edited" : "created", "employees", { id: user.id, ref: user.email }, v.password && id ? { passwordReset: true } : undefined);
    revalidate();
    return { ok: true, id: user.id };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, message: dict.validation.fixErrors, errors: { email: dict.validation.emailExists } };
    }
    console.error("[employees]", err);
    return { ok: false, message: dict.common.errorToast };
  }
}

export async function setEmployeeStatus(id: string, active: boolean): Promise<EmployeeResult> {
  const me = await getSessionUser();
  const dict = getDict();
  if (!can(me.permissions, "employees", "edit")) return { ok: false, message: dict.common.forbidden };
  if (id === me.id) return { ok: false, message: dict.employees.cannotSelf };
  const u = await prisma.user.findUnique({ where: { id }, include: { role: true } });
  if (!u) return { ok: false, message: dict.common.errorToast };
  if (u.role.key === "SUPER_ADMIN" && me.role.key !== "SUPER_ADMIN") return { ok: false, message: dict.common.forbidden };
  if (!active && (await wouldOrphanSuperAdmin(id, u.roleId, false))) return { ok: false, message: dict.employees.lastSuperAdmin };
  await prisma.user.update({ where: { id }, data: { status: active ? "ACTIVE" : "INACTIVE" } });
  await audit(me, active ? "edited" : "archived", "employees", { id, ref: u.email }, { status: active ? "ACTIVE" : "INACTIVE" });
  revalidate();
  return { ok: true, id };
}

/** Replace one role's permission rows. Super Admin only; the Super Admin role itself is locked. */
export async function saveRolePermissions(roleId: string, matrix: Partial<Record<Module, Action[]>>) {
  const me = await getSessionUser();
  const dict = getDict();
  if (me.role.key !== "SUPER_ADMIN") return { ok: false as const, message: dict.common.forbidden };
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) return { ok: false as const, message: dict.common.errorToast };
  if (role.key === "SUPER_ADMIN") return { ok: false as const, message: dict.employees.superAdminLocked };

  const rows = MODULES.flatMap((m) =>
    (matrix[m] ?? []).filter((a) => (ACTIONS as readonly string[]).includes(a)).map((action) => ({ roleId, module: m, action })),
  );
  // a role that can do anything in a module must at least be able to see it
  for (const m of MODULES) {
    if ((matrix[m] ?? []).length && !(matrix[m] ?? []).includes("view")) rows.push({ roleId, module: m, action: "view" });
  }
  await prisma.$transaction([prisma.rolePermission.deleteMany({ where: { roleId } }), prisma.rolePermission.createMany({ data: rows })]);
  await audit(me, "edited", "employees", { id: roleId, ref: role.name }, { permissions: rows.length });
  revalidatePath("/", "layout");
  return { ok: true as const };
}
