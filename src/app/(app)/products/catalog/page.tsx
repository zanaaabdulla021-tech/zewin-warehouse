import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getDict } from "@/i18n/server";
import { Forbidden } from "@/components/layout/module-states";
import { PageHeader } from "@/components/ui/card";
import { CatalogManager } from "./catalog-manager";

export const metadata = { title: "Categories & Units" };

export default async function CatalogPage() {
  const user = await getSessionUser();
  if (!can(user.permissions, "products", "edit")) return <Forbidden />;
  const dict = getDict();
  const [categories, units] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { products: true } } } }),
    prisma.unit.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { products: true } } } }),
  ]);
  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href="/products" className="inline-flex items-center gap-1 hover:text-ink">
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            {dict.products.title}
          </Link>
        }
        title={dict.catalog.title}
        description={dict.catalog.subtitle}
      />
      <CatalogManager
        categories={categories.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId, products: c._count.products }))}
        units={units.map((u) => ({ id: u.id, name: u.name, symbol: u.symbol, products: u._count.products }))}
      />
    </>
  );
}
