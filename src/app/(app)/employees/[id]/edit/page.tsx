import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getDict } from "@/i18n/server";
import { Forbidden } from "@/components/layout/module-states";
import { PageHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { EmployeeForm } from "../../employee-form";
import { employeeLookups } from "../../lookups";

export const metadata = { title: "Edit employee" };

export default async function EditEmployeePage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!can(user.permissions, "employees", "edit")) return <Forbidden />;
  const dict = getDict();
  const [emp, lookups] = await Promise.all([
    prisma.user.findUnique({ where: { id: params.id }, include: { role: true, warehouses: { select: { warehouseId: true } } } }),
    employeeLookups(user),
  ]);
  if (!emp) notFound();
  if (emp.role.key === "SUPER_ADMIN" && user.role.key !== "SUPER_ADMIN") return <Forbidden />;
  const status = emp.status === "ACTIVE" ? "ACTIVE" : "INACTIVE";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumb={
          <Link href="/employees" className="inline-flex items-center gap-1 hover:text-ink">
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            {dict.employees.title}
          </Link>
        }
        title={dict.employees.editTitle}
        badge={<StatusBadge status={status} label={dict.status[status]} />}
        description={
          <>
            {emp.name} · <span dir="ltr">{emp.email}</span>
          </>
        }
      />
      <EmployeeForm
        id={emp.id}
        isSelf={emp.id === user.id}
        {...lookups}
        initial={{
          name: emp.name,
          email: emp.email,
          phone: emp.phone ?? "",
          roleId: emp.roleId,
          password: "",
          warehouseIds: emp.warehouses.map((w) => w.warehouseId),
          status,
        }}
      />
    </div>
  );
}
