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
import { ProductForm } from "../../product-form";
import { catalogOptions } from "../../queries";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!can(user.permissions, "products", "edit")) return <Forbidden />;
  const dict = getDict();
  const [p, { categories, units }] = await Promise.all([
    prisma.product.findUnique({ where: { id: params.id } }),
    catalogOptions(),
  ]);
  if (!p) notFound();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumb={
          <Link href={`/products/${p.id}`} className="inline-flex items-center gap-1 hover:text-ink">
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            {p.name}
          </Link>
        }
        title={dict.products.editTitle}
        badge={<StatusBadge status={p.status} label={dict.status[p.status].toUpperCase()} />}
        description={
          <>
            {dict.products.product}: <span className="font-medium text-ink-soft">{p.name}</span>{" "}
            <span className="font-mono text-[13px]" dir="ltr">({p.code})</span>
          </>
        }
      />
      <ProductForm
        mode="edit"
        id={p.id}
        categories={categories}
        units={units}
        canManageCatalog
        footerNote={`${dict.common.lastUpdated}: ${formatDate(p.updatedAt)} ${formatTime(p.updatedAt)}`}
        initial={{
          name: p.name,
          code: p.code,
          barcode: p.barcode ?? "",
          categoryId: p.categoryId ?? "",
          unitId: p.unitId ?? "",
          purchasePrice: p.purchasePrice.toFixed(2),
          sellingPrice: p.sellingPrice.toFixed(2),
          taxRate: p.taxRate.toString(),
          discountRate: p.discountRate.toString(),
          minQuantity: p.minQuantity.toString(),
          tracksBatch: p.tracksBatch,
          tracksExpiry: p.tracksExpiry,
          description: p.description ?? "",
          imageUrl: p.imageUrl ?? "",
          notes: p.notes ?? "",
          status: p.status,
        }}
      />
    </div>
  );
}
