import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getDict } from "@/i18n/server";
import { formatDate, formatTime } from "@/lib/utils";
import { Forbidden } from "@/components/layout/module-states";
import { PageHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { SupplierForm } from "../../supplier-form";

export const metadata = { title: "Edit supplier" };

export default async function EditSupplierPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!can(user.permissions, "suppliers", "edit")) return <Forbidden />;
  const dict = getDict();
  const s = await prisma.supplier.findUnique({ where: { id: params.id } });
  if (!s) notFound();
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumb={
          <Link href={`/suppliers/${s.id}`} className="inline-flex items-center gap-1 hover:text-ink">
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            {s.name}
          </Link>
        }
        title={dict.suppliers.editTitle}
        badge={<StatusBadge status={s.status} label={dict.status[s.status]} />}
        description={<span className="font-mono" dir="ltr">{s.code}</span>}
      />
      <SupplierForm
        id={s.id}
        footerNote={`${dict.common.lastUpdated}: ${formatDate(s.updatedAt)} ${formatTime(s.updatedAt)}`}
        initial={{
          name: s.name,
          code: s.code,
          contactName: s.contactName ?? "",
          phone: s.phone ?? "",
          email: s.email ?? "",
          city: s.city ?? "",
          address: s.address ?? "",
          taxNumber: s.taxNumber ?? "",
          notes: s.notes ?? "",
          status: s.status,
        }}
      />
    </div>
  );
}
