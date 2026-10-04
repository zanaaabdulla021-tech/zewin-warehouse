import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getDict } from "@/i18n/server";
import { Forbidden } from "@/components/layout/module-states";
import { PageHeader } from "@/components/ui/card";
import { ProductForm } from "../product-form";
import { emptyProduct } from "../schema";
import { catalogOptions, nextProductCode } from "../queries";

export const metadata = { title: "Add product" };

export default async function NewProductPage({ searchParams }: { searchParams: { t?: string } }) {
  const user = await getSessionUser();
  if (!can(user.permissions, "products", "create")) return <Forbidden />;
  const dict = getDict();
  const [{ categories, units }, code] = await Promise.all([catalogOptions(), nextProductCode()]);
  const initial = emptyProduct(code);
  // default to the most common unit so the form is one field shorter
  if (units[0]) initial.unitId = units[0].value;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumb={
          <Link href="/products" className="inline-flex items-center gap-1 hover:text-ink">
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            {dict.products.title}
          </Link>
        }
        title={dict.products.addTitle}
        description={dict.products.addSubtitle}
      />
      <ProductForm
        key={searchParams.t ?? "new"}
        mode="create"
        initial={initial}
        categories={categories}
        units={units}
        canManageCatalog={can(user.permissions, "products", "edit")}
      />
    </div>
  );
}
