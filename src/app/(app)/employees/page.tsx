import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getDict } from "@/i18n/server";
import { Forbidden } from "@/components/layout/module-states";
import { PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmployeesTabs } from "./employees-tabs";
import { EmployeeList, type EmployeeRow } from "./employee-list";

export const metadata = { title: "Employees" };

export default async function EmployeesPage() {
  const user = await getSessionUser();
  if (!can(user.permissions, "employees")) return <Forbidden />;
  const dict = getDict();

  const users = await prisma.user.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: { role: { select: { key: true, name: true } }, warehouses: { include: { warehouse: { select: { name: true } } } } },
  });
  const lastSeen = await prisma.auditLog.groupBy({ by: ["userId"], _max: { createdAt: true } });
  const seen = new Map(lastSeen.map((l) => [l.userId, l._max.createdAt]));

  const rows: EmployeeRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role.name,
    roleKey: u.role.key,
    warehouses: u.warehouses.map((w) => w.warehouse.name),
    status: u.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
    lastActivity: seen.get(u.id)?.toISOString() ?? null,
    isMe: u.id === user.id,
  }));

  const canCreate = can(user.permissions, "employees", "create");
  return (
    <>
      <PageHeader
        title={dict.employees.title}
        description={dict.employees.subtitle}
        actions={
          canCreate && (
            <Link href="/employees/new">
              <Button icon={<Plus className="h-4 w-4" />}>{dict.employees.add}</Button>
            </Link>
          )
        }
      />
      <EmployeesTabs active="employees" showRoles={user.role.key === "SUPER_ADMIN"} />
      <EmployeeList
        rows={rows}
        perms={{ create: canCreate, edit: can(user.permissions, "employees", "edit"), export: can(user.permissions, "employees", "export") }}
        isSuperAdmin={user.role.key === "SUPER_ADMIN"}
      />
    </>
  );
}
