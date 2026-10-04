import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getAppSettings } from "@/lib/settings";
import { channelStatus } from "@/lib/notify";
import { getDict } from "@/i18n/server";
import { cn, formatNumber } from "@/lib/utils";
import { Forbidden } from "@/components/layout/module-states";
import { PageHeader } from "@/components/ui/card";
import { AppSettingsForm, CompanyForm } from "./settings-forms";
import { AuditTable } from "./audit-table";
import { CurrencyManager } from "./currency-manager";
import { getBaseCurrencyCode } from "@/lib/utils";

export const metadata = { title: "Settings" };

const TABS = ["company", "currencies", "documents", "audit", "system"] as const;
type Tab = (typeof TABS)[number];

export default async function SettingsPage({ searchParams }: { searchParams: { tab?: string } }) {
  const user = await getSessionUser();
  if (!can(user.permissions, "settings")) return <Forbidden />;
  const dict = getDict();
  const s = dict.settings;
  const tab: Tab = TABS.includes(searchParams.tab as Tab) ? (searchParams.tab as Tab) : "company";
  const readOnly = !can(user.permissions, "settings", "edit");
  const labels: Record<Tab, string> = { company: s.tabCompany, currencies: dict.currency.tab, documents: s.tabDocuments, audit: s.tabAudit, system: s.tabSystem };

  return (
    <>
      <PageHeader title={s.title} description={s.subtitle} />
      <nav className="zw-scroll -mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        {TABS.map((tb) => (
          <Link
            key={tb}
            href={tb === "company" ? "/settings" : `/settings?tab=${tb}`}
            aria-current={tab === tb ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-4 py-3 text-[14px] font-medium",
              tab === tb ? "border-brand-600 text-brand-800" : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {labels[tb]}
          </Link>
        ))}
        <Link href="/account" className="-mb-px shrink-0 border-b-2 border-transparent px-4 py-3 text-[14px] font-medium text-ink-muted hover:text-ink">
          {s.tabAccount}
        </Link>
      </nav>

      <div className={cn(tab !== "audit" && "mx-auto max-w-5xl")}>{await renderTab(tab, readOnly, can(user.permissions, "settings", "edit"))}</div>
    </>
  );
}

async function renderTab(tab: Tab, readOnly: boolean, canExport: boolean) {
  const dict = getDict();
  const s = dict.settings;
  switch (tab) {
    case "company": {
      const c = await prisma.company.findFirst();
      return (
        <CompanyForm
          readOnly={readOnly}
          initial={{
            name: c?.name ?? "",
            legalName: c?.legalName ?? "",
            taxNumber: c?.taxNumber ?? "",
            phone: c?.phone ?? "",
            email: c?.email ?? "",
            address: c?.address ?? "",
            currency: c?.currency ?? "USD",
          }}
        />
      );
    }
    case "currencies": {
      const base = getBaseCurrencyCode();
      // make sure the base currency row exists (rate 1)
      await prisma.currency.upsert({ where: { code: base }, update: { rate: 1, active: true }, create: { code: base, name: base, rate: 1 } });
      const rows = await prisma.currency.findMany({ orderBy: [{ active: "desc" }, { code: "asc" }] });
      return (
        <CurrencyManager
          base={base}
          readOnly={readOnly}
          currencies={rows
            .sort((a, b) => (a.code === base ? -1 : b.code === base ? 1 : 0))
            .map((c) => ({ code: c.code, name: c.name, symbol: c.symbol, rate: Number(c.rate), active: c.active, updatedAt: c.updatedAt.toISOString() }))}
        />
      );
    }
    case "documents": {
      const a = await getAppSettings();
      return (
        <AppSettingsForm
          readOnly={readOnly}
          initial={{ defaultDocType: a.defaultDocType, defaultTaxRate: String(a.defaultTaxRate), expiryWarningDays: String(a.expiryWarningDays) }}
        />
      );
    }
    case "audit": {
      const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 2000 });
      return (
        <AuditTable
          canExport={canExport}
          rows={logs.map((l) => ({
            id: l.id,
            at: l.createdAt.toISOString(),
            user: l.userName,
            action: l.action,
            module: l.module,
            record: l.recordRef,
            details: l.details ? JSON.stringify(l.details) : null,
          }))}
        />
      );
    }
    case "system": {
      const [users, warehouses, products, documents, movements, logs] = await Promise.all([
        prisma.user.count(),
        prisma.warehouse.count(),
        prisma.product.count(),
        prisma.document.count(),
        prisma.stockMovement.count(),
        prisma.auditLog.count(),
      ]);
      const rows: [string, string][] = [
        [s.version, "ZEWIN Warehouse & Accounting 1.0.0"],
        [s.environment, process.env.NODE_ENV ?? "—"],
        [s.database, "PostgreSQL (Neon) · Prisma"],
        [dict.nav.employees, formatNumber(users)],
        [dict.nav.warehouses, formatNumber(warehouses)],
        [dict.nav.products, formatNumber(products)],
        [dict.nav.documents, formatNumber(documents)],
        [dict.reports.movements, formatNumber(movements)],
        [s.tabAudit, formatNumber(logs)],
        [`${dict.notifications.channelStatus} · ${dict.notifications.email}`, channelStatus().email ? dict.notifications.configured : dict.notifications.notConfigured],
        [`${dict.notifications.channelStatus} · ${dict.notifications.whatsapp}`, channelStatus().whatsapp ? dict.notifications.configured : dict.notifications.notConfigured],
      ];
      return (
        <div className="zw-card">
          <dl className="divide-y divide-line">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 px-5 py-3.5 text-[14px]">
                <dt className="text-ink-muted">{k}</dt>
                <dd className="font-medium tabular text-ink" dir="ltr">
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      );
    }
  }
}
