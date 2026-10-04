import Link from "next/link";
import { ArrowRight, BarChart3, Boxes, FileText, History, Package, ShieldCheck, Truck, Warehouse } from "lucide-react";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getDict } from "@/i18n/server";
import { Forbidden } from "@/components/layout/module-states";
import { PageHeader } from "@/components/ui/card";
import { REPORT_KEYS, type ReportKey } from "./data";

export const metadata = { title: "Reports" };

const ICONS: Record<ReportKey, React.ElementType> = {
  stock: Boxes,
  warehouse: Warehouse,
  product: Package,
  accounting: FileText,
  verification: ShieldCheck,
  supplier: Truck,
  movement: History,
};

export default async function ReportsPage() {
  const user = await getSessionUser();
  if (!can(user.permissions, "reports")) return <Forbidden />;
  const r = getDict().reports;
  return (
    <>
      <PageHeader title={r.title} description={r.subtitle} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {REPORT_KEYS.map((k) => {
          const Icon = ICONS[k] ?? BarChart3;
          return (
            <Link key={k} href={`/reports/${k}`} className="zw-card group flex flex-col p-5 transition-shadow hover:shadow-pop">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Icon className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-[16px] font-semibold text-ink">{r.items[k].title}</h2>
              <p className="mt-1 flex-1 text-[13.5px] leading-relaxed text-ink-muted">{r.items[k].desc}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-brand-700">
                {r.open}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
