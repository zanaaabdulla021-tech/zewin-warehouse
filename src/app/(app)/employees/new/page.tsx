import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getDict } from "@/i18n/server";
import { Forbidden } from "@/components/layout/module-states";
import { PageHeader } from "@/components/ui/card";
import { EmployeeForm } from "../employee-form";
import { employeeLookups } from "../lookups";

export const metadata = { title: "Add employee" };

export default async function NewEmployeePage() {
  const user = await getSessionUser();
  if (!can(user.permissions, "employees", "create")) return <Forbidden />;
  const dict = getDict();
  const { roles, warehouses } = await employeeLookups(user);
  const defaultRole = roles.find((r) => r.label === "Warehouse Employee")?.value ?? "";
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumb={
          <Link href="/employees" className="inline-flex items-center gap-1 hover:text-ink">
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            {dict.employees.title}
          </Link>
        }
        title={dict.employees.addTitle}
        description={dict.employees.addSubtitle}
      />
      <EmployeeForm
        roles={roles}
        warehouses={warehouses}
        initial={{ name: "", email: "", phone: "", roleId: defaultRole, password: "", warehouseIds: [], status: "ACTIVE" }}
      />
    </div>
  );
}
