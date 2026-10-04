import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getDict } from "@/i18n/server";
import { getAppSettings } from "@/lib/settings";
import { DOC_TYPES, type DocType } from "@/lib/documents";
import { Forbidden } from "@/components/layout/module-states";
import { PageHeader } from "@/components/ui/card";
import { DocumentForm } from "../document-form";
import { documentLookups, todayIso } from "../queries";

export const metadata = { title: "New document" };

export default async function NewDocumentPage({ searchParams }: { searchParams: { type?: string; warehouse?: string } }) {
  const user = await getSessionUser();
  if (!can(user.permissions, "documents", "create")) return <Forbidden />;
  const dict = getDict();
  const [lookups, settings] = await Promise.all([documentLookups(), getAppSettings()]);
  const type = DOC_TYPES.includes(searchParams.type as DocType) ? (searchParams.type as DocType) : settings.defaultDocType;
  const warehouseId =
    lookups.warehouses.find((w) => w.value === searchParams.warehouse)?.value ??
    (lookups.warehouses.length === 1 ? lookups.warehouses[0]!.value : "");

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumb={
          <Link href="/documents" className="inline-flex items-center gap-1 hover:text-ink">
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            {dict.documents.title}
          </Link>
        }
        title={dict.documents.createTitle}
      />
      <DocumentForm
        mode="create"
        today={todayIso()}
        {...lookups}
        initial={{
          type,
          date: todayIso(),
          warehouseId,
          toWarehouseId: "",
          supplierId: "",
          referenceNumber: "",
          notes: "",
          currency: lookups.baseCurrency,
          exchangeRate: "1",
          lines: [],
        }}
      />
    </div>
  );
}
