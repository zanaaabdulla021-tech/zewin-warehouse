import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getDict } from "@/i18n/server";
import { Forbidden } from "@/components/layout/module-states";
import { PageHeader } from "@/components/ui/card";
import { ImportWizard } from "./import-wizard";

export const metadata = { title: "Import opening balance" };

export default async function ImportPage() {
  const user = await getSessionUser();
  if (!can(user.permissions, "stock", "edit")) return <Forbidden />;
  const dict = getDict();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumb={
          <Link href="/stock" className="inline-flex items-center gap-1 hover:text-ink">
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            {dict.stock.title}
          </Link>
        }
        title={dict.importer.title}
        description={dict.importer.subtitle}
      />
      <ImportWizard />
    </div>
  );
}
