"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Eye, Package, Pencil, Plus, SearchX, Tags, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { cn, formatMoney, formatNumber } from "@/lib/utils";
import { PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { archiveProduct } from "./actions";
import { useDeleteProduct } from "./use-delete-product";

export type ProductRow = {
  id: string;
  code: string;
  name: string;
  barcode: string | null;
  imageUrl: string | null;
  category: string | null;
  unit: string;
  buy: number;
  sell: number;
  qty: number;
  min: number;
  warehouses: number;
  nearestExpiry: string | null;
  low: boolean;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
};

export function ProductThumb({ name, imageUrl, size = 36 }: { name: string; imageUrl: string | null; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-gradient-to-br from-brand-50 to-white text-[12px] font-semibold text-brand-700"
      style={{ width: size, height: size }}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        name.slice(0, 2).toUpperCase()
      )}
    </span>
  );
}

/** Quantity + a thin bar showing how far above/below minimum the product is. */
function StockCell({ r, labels }: { r: ProductRow; labels: { out: string; low: string } }) {
  const pct = r.min > 0 ? Math.min(100, (r.qty / (r.min * 2)) * 100) : 100;
  return (
    <div className="ms-auto w-32 text-end">
      <div className="flex items-center justify-end gap-2">
        {r.qty === 0 ? (
          <Badge tone="red" dot={false}>{labels.out}</Badge>
        ) : r.low ? (
          <Badge tone="yellow" dot={false}>{labels.low}</Badge>
        ) : null}
        <span className={cn("font-medium", r.low ? "text-amber-700" : "text-ink")} dir="ltr">
          {formatNumber(r.qty)} <span className="text-[12px] font-normal text-ink-muted">{r.unit}</span>
        </span>
      </div>
      {r.min > 0 && (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn("h-full rounded-full", r.qty === 0 ? "bg-red-400" : r.low ? "bg-amber-400" : "bg-brand-400")}
            style={{ width: `${Math.max(3, pct)}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function ProductList({
  rows,
  initialFilter,
  perms,
}: {
  rows: ProductRow[];
  initialFilter?: string;
  perms: { create: boolean; edit: boolean; delete: boolean; export: boolean };
}) {
  const { dict } = useI18n();
  const p = dict.products;
  const router = useRouter();
  const toast = useToast();
  const { askDelete, dialog } = useDeleteProduct();
  const stockLabels = { out: p.outOfStock, low: p.lowStock };

  const addBtn = perms.create && (
    <Link href="/products/new">
      <Button icon={<Plus className="h-4 w-4" />}>{p.add}</Button>
    </Link>
  );

  const columns: Column<ProductRow>[] = [
    {
      key: "name",
      header: p.colProduct,
      sortable: true,
      value: (r) => r.name,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <ProductThumb name={r.name} imageUrl={r.imageUrl} />
          <div className="min-w-0">
            <Link href={`/products/${r.id}`} className="block truncate font-medium text-ink hover:text-brand-700">
              {r.name}
            </Link>
            <span className="font-mono text-[12px] text-ink-muted" dir="ltr">{r.code}</span>
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: p.colCategory,
      sortable: true,
      value: (r) => r.category ?? "",
      cell: (r) => <span className="text-ink-soft">{r.category ?? "—"}</span>,
    },
    {
      key: "qty",
      header: p.colStock,
      sortable: true,
      align: "end",
      value: (r) => r.qty,
      cell: (r) => <StockCell r={r} labels={stockLabels} />,
    },
    {
      key: "sell",
      header: p.colPrice,
      sortable: true,
      align: "end",
      value: (r) => r.sell,
      cell: (r) => (
        <div dir="ltr" className="text-end">
          <div className="font-medium">{formatMoney(r.sell)}</div>
          <div className="text-[12px] text-ink-muted">{formatMoney(r.buy)}</div>
        </div>
      ),
    },
    {
      key: "status",
      header: dict.common.status,
      value: (r) => r.status,
      cell: (r) => <StatusBadge status={r.status} label={dict.status[r.status]} />,
    },
  ];

  const lowCount = rows.filter((r) => r.low && r.status === "ACTIVE").length;

  return (
    <>
      <PageHeader
        title={p.title}
        description={p.subtitle}
        actions={
          <>
            {perms.edit && (
              <Link href="/products/catalog">
                <Button variant="secondary" icon={<Tags className="h-4 w-4" />}>
                  {p.manageCatalog}
                </Button>
              </Link>
            )}
            {addBtn}
          </>
        }
      />
      <DataTable
        rows={rows}
        columns={columns}
        filterValue={initialFilter}
        searchText={(r) => `${r.name} ${r.code} ${r.barcode ?? ""} ${r.category ?? ""}`}
        filters={[
          { value: "ACTIVE", label: dict.status.ACTIVE, count: rows.filter((r) => r.status === "ACTIVE").length },
          { value: "LOW", label: p.filterLow, count: lowCount },
          { value: "INACTIVE", label: dict.status.INACTIVE, count: rows.filter((r) => r.status === "INACTIVE").length },
          { value: "ARCHIVED", label: dict.status.ARCHIVED, count: rows.filter((r) => r.status === "ARCHIVED").length },
        ]}
        filterMatch={(r, f) => (f === "LOW" ? r.low && r.status === "ACTIVE" : r.status === f)}
        onRowClick={(r) => router.push(`/products/${r.id}`)}
        canExport={perms.export}
        exportName="products"
        pageSize={12}
        rowActions={(r) => (
          <DropdownMenu
            label={dict.common.actions}
            items={[
              { label: dict.common.view, icon: <Eye />, onSelect: () => router.push(`/products/${r.id}`) },
              { label: dict.common.edit, icon: <Pencil />, hidden: !perms.edit, onSelect: () => router.push(`/products/${r.id}/edit`) },
              {
                label: dict.common.archive,
                icon: <Archive />,
                hidden: !perms.edit || r.status === "ARCHIVED",
                onSelect: async () => {
                  const res = await archiveProduct(r.id);
                  toast(res.ok ? { tone: "success", title: p.archived } : { tone: "error", title: res.message });
                  router.refresh();
                },
              },
              "separator",
              { label: dict.common.delete, icon: <Trash2 />, danger: true, hidden: !perms.delete, onSelect: () => askDelete(r) },
            ]}
          />
        )}
        mobileCard={(r) => (
          <div className="flex items-center gap-3">
            <ProductThumb name={r.name} imageUrl={r.imageUrl} size={40} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-ink">{r.name}</div>
              <div className="mt-0.5 flex items-center gap-2 text-[12.5px] text-ink-muted">
                <span className="font-mono" dir="ltr">{r.code}</span>
                <span dir="ltr">{formatMoney(r.sell)}</span>
              </div>
            </div>
            <div className={cn("text-end text-[14px] font-semibold", r.low ? "text-amber-700" : "text-ink")} dir="ltr">
              {formatNumber(r.qty)}
              <div className="text-[11px] font-normal text-ink-muted">{r.unit}</div>
            </div>
          </div>
        )}
        empty={<EmptyState icon={<Package className="h-5 w-5" />} title={p.emptyTitle} body={p.emptyBody} action={addBtn} />}
        emptyFiltered={<EmptyState compact icon={<SearchX className="h-5 w-5" />} title={p.emptyFiltered} body={p.emptyFilteredBody} />}
      />
      {dialog}
    </>
  );
}
