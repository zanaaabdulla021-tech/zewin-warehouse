import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { getDict } from "@/i18n/server";
import { Forbidden } from "@/components/layout/module-states";
import { PageHeader } from "@/components/ui/card";
import type { Action, Module } from "@/lib/permissions";
import { EmployeesTabs } from "../employees-tabs";
import { RoleMatrix } from "./role-matrix";

export const metadata = { title: "Roles & Permissions" };

export default async function RolesPage() {
  const user = await getSessionUser();
  if (user.role.key !== "SUPER_ADMIN") return <Forbidden />;
  const dict = getDict();
  const roles = await prisma.role.findMany({
    orderBy: { createdAt: "asc" },
    include: { permissions: true, _count: { select: { users: true } } },
  });
  return (
    <>
      <PageHeader title={dict.employees.title} description={dict.employees.rolesSubtitle} />
      <EmployeesTabs active="roles" showRoles />
      <RoleMatrix
        roles={roles.map((r) => {
          const m: Partial<Record<Module, Action[]>> = {};
          for (const p of r.permissions) (m[p.module as Module] ??= []).push(p.action as Action);
          return { id: r.id, key: r.key, name: r.name, users: r._count.users, matrix: m };
        })}
      />
    </>
  );
}
