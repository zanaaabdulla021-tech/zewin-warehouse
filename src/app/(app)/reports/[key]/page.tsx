import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getDict } from "@/i18n/server";
import { Forbidden } from "@/components/layout/module-states";
import { PageHeader } from "@/components/ui/card";
import { buildReport, REPORT_KEYS, type ReportKey } from "../data";
import { ReportView } from "./report-view";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: { key: string };
  searchParams: { from?: string; to?: string; wh?: string };
}) {
  if (!REPORT_KEYS.includes(params.key as ReportKey)) notFound();
  const key = params.key as ReportKey;
  const user = await getSessionUser();
  if (!can(user.permissions, "reports")) return <Forbidden />;
  const dict = getDict();

  // default period: first day of this month → today
  const now = new Date();
  const fromStr = searchParams.from ?? iso(new Date(now.getFullYear(), now.getMonth(), 1));
  const toStr = searchParams.to ?? iso(now);
  const from = new Date(`${fromStr}T00:00:00`);
  const to = new Date(`${toStr}T23:59:59.999`);
  const valid = !Number.isNaN(+from) && !Number.isNaN(+to);

  const warehouses = await prisma.warehouse.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const warehouseId = warehouses.find((w) => w.id === searchParams.wh)?.id ?? null;

  const data = await buildReport(key, { from: valid ? from : new Date(0), to: valid ? to : now, warehouseId }, dict);

  return (
    <>
      <div className="no-print">
        <PageHeader
          breadcrumb={
            <Link href="/reports" className="inline-flex items-center gap-1 hover:text-ink">
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              {dict.reports.title}
            </Link>
          }
          title={dict.reports.items[key].title}
          description={dict.reports.items[key].desc}
        />
      </div>
      <ReportView
        reportKey={key}
        title={dict.reports.items[key].title}
        data={data}
        from={fromStr}
        to={toStr}
        warehouseId={warehouseId ?? ""}
        warehouseName={warehouses.find((w) => w.id === warehouseId)?.name ?? null}
        warehouses={warehouses.map((w) => ({ value: w.id, label: w.name }))}
        canExport={can(user.permissions, "reports", "export")}
      />
    </>
  );
}
