import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getDict } from "@/i18n/server";
import { Forbidden } from "@/components/layout/module-states";
import { PageHeader } from "@/components/ui/card";
import { SupplierForm } from "../supplier-form";
import { emptySupplier } from "../schema";

export const metadata = { title: "Add supplier" };

export default async function NewSupplierPage() {
  const user = await getSessionUser();
  if (!can(user.permissions, "suppliers", "create")) return <Forbidden />;
  const dict = getDict();
  const rows = await prisma.supplier.findMany({ where: { code: { startsWith: "SUP-" } }, select: { code: true } });
  const next = `SUP-${String(rows.reduce((m, r) => Math.max(m, Number(r.code.slice(4)) || 0), 0) + 1).padStart(3, "0")}`;
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumb={
          <Link href="/suppliers" className="inline-flex items-center gap-1 hover:text-ink">
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            {dict.suppliers.title}
          </Link>
        }
        title={dict.suppliers.addTitle}
        description={dict.suppliers.addSubtitle}
      />
      <SupplierForm initial={emptySupplier(next)} />
    </div>
  );
}
