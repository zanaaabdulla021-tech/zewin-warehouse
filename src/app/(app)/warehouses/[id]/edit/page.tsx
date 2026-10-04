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
import { managerOptions } from "../../queries";
import { WarehouseForm } from "./warehouse-form";

export const metadata = { title: "Edit warehouse" };

export default async function EditWarehousePage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!can(user.permissions, "warehouses", "edit")) return <Forbidden />;
  const dict = getDict();
  const [wh, managers] = await Promise.all([prisma.warehouse.findUnique({ where: { id: params.id } }), managerOptions()]);
  if (!wh) notFound();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumb={
          <Link href={`/warehouses/${wh.id}`} className="inline-flex items-center gap-1 hover:text-ink">
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            {wh.name}
          </Link>
        }
        title={dict.warehouses.editTitle}
        badge={<StatusBadge status={wh.status} label={dict.status[wh.status]} />}
        description={
          <>
            {dict.warehouses.colWarehouse}: <span className="font-medium text-ink-soft">{wh.name}</span>{" "}
            <span className="font-mono text-[13px]" dir="ltr">({wh.code})</span>
          </>
        }
      />
      <WarehouseForm
        id={wh.id}
        managers={managers}
        lastUpdated={`${formatDate(wh.updatedAt)} ${formatTime(wh.updatedAt)}`}
        initial={{
          name: wh.name,
          code: wh.code,
          type: wh.type,
          city: wh.city ?? "",
          address: wh.address ?? "",
          phone: wh.phone ?? "",
          managerId: wh.managerId ?? "",
          capacity: wh.capacity?.toString() ?? "",
          status: wh.status,
          notes: wh.notes ?? "",
        }}
      />
    </div>
  );
}
