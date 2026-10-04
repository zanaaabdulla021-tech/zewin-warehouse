import "server-only";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";

/** Roles the current user may assign (only Super Admins can grant Super Admin). */
export async function employeeLookups(me: SessionUser) {
  const [roles, warehouses] = await Promise.all([
    prisma.role.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.warehouse.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
  ]);
  return {
    roles: roles
      .filter((r) => r.key !== "SUPER_ADMIN" || me.role.key === "SUPER_ADMIN")
      .map((r) => ({ value: r.id, label: r.name, description: r.description })),
    warehouses: warehouses.map((w) => ({ value: w.id, label: w.name, meta: w.code })),
  };
}
