"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Boxes, SearchX } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { cn, formatDate, formatMoney, formatNumber } from "@/lib/utils";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/input";

export type StockRow = {
  id: string;
  productId: string;
  product: string;
  code: string;
  unit: string;
  warehouseId: string;
  warehouse: string;
  batch: string | null;
  expiry: string | null;
  days: number | null;
  qty: number;
  value: number;
  status: "OK" | "LOW" | "EXPIRING" | "EXPIRED";
};

const TONE: Record<StockRow["status"], BadgeTone> = { OK: "green", LOW: "yellow", EXPIRING: "yellow", EXPIRED: "red" };

export function StockTable({
  rows,
  warehouses,
  warehouseId,
  initialFilter,
  canExport,
}: {
  rows: StockRow[];
  warehouses: { value: string; label: string }[];
  warehouseId: string;
  initialFilter?: string;
  canExport: boolean;
}) {
  const { dict, t } = useI18n();
  const s = dict.stock;
  const router = useRouter();
  const label: Record<StockRow["status"], string> = {
    OK: s.statusOk,
    LOW: s.statusLow,
    EXPIRING: s.statusExpiring,
    EXPIRED: s.statusExpired,
  };

  const columns: Column<StockRow>[] = [
    {
      key: "product",
      header: s.product,
      sortable: true,
      value: (r) => r.product,
      cell: (r) => (
        <div className="min-w-0">
          <Link href={`/products/${r.productId}`} className="block truncate font-medium text-ink hover:text-brand-700">
            {r.product}
          </Link>
          <span className="font-mono text-[12px] text-ink-muted" dir="ltr">{r.code}</span>
        </div>
      ),
    },
    {
      key: "warehouse",
      header: s.warehouse,
      sortable: true,
      value: (r) => r.warehouse,
      cell: (r) => (
        <Link href={`/warehouses/${r.warehouseId}`} className="text-ink-soft hover:text-brand-700">
          {r.warehouse}
        </Link>
      ),
    },
    {
      key: "batch",
      header: s.batch,
      value: (r) => r.batch ?? "",
      cell: (r) => <span className="font-mono text-[13px] text-ink-soft" dir="ltr">{r.batch ?? "—"}</span>,
    },
    {
      key: "expiry",
      header: s.expiry,
      sortable: true,
      value: (r) => r.expiry ?? "9999",
      cell: (r) =>
        r.expiry ? (
          <div>
            <div className={cn("text-[13.5px]", r.status === "EXPIRED" ? "text-red-600" : r.status === "EXPIRING" ? "text-amber-700" : "text-ink-soft")}>
              {formatDate(r.expiry)}
            </div>
            {r.days !== null && r.days <= 60 && (
              <div className="text-[12px] text-ink-muted">
                {r.days < 0 ? t(s.expiredAgo, { n: -r.days }) : t(s.daysLeft, { n: r.days })}
              </div>
            )}
          </div>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
    {
      key: "qty",
      header: s.onHand,
      sortable: true,
      align: "end",
      value: (r) => r.qty,
      cell: (r) => (
        <span className="font-semibold" dir="ltr">
          {formatNumber(r.qty)} <span className="text-[12px] font-normal text-ink-muted">{r.unit}</span>
        </span>
      ),
    },
    {
      key: "value",
      header: s.value,
      sortable: true,
      align: "end",
      value: (r) => +r.value.toFixed(2),
      cell: (r) => <span dir="ltr">{formatMoney(r.value)}</span>,
    },
    {
      key: "status",
      header: s.status,
      value: (r) => label[r.status],
      cell: (r) => <Badge tone={TONE[r.status]}>{label[r.status]}</Badge>,
    },
  ];

  const count = (st: StockRow["status"]) => rows.filter((r) => r.status === st).length;

  return (
    <DataTable
      rows={rows}
      columns={columns}
      pageSize={15}
      filterValue={initialFilter && ["LOW", "EXPIRING", "EXPIRED"].includes(initialFilter) ? initialFilter : undefined}
      searchText={(r) => `${r.product} ${r.code} ${r.batch ?? ""} ${r.warehouse}`}
      filters={[
        { value: "LOW", label: s.statusLow, count: count("LOW") },
        { value: "EXPIRING", label: s.statusExpiring, count: count("EXPIRING") },
        { value: "EXPIRED", label: s.statusExpired, count: count("EXPIRED") },
      ]}
      filterOf={(r) => r.status}
      canExport={canExport}
      exportName="stock"
      toolbar={
        <Select
          value={warehouseId}
          onChange={(e) => router.push(e.target.value ? `/stock?wh=${e.target.value}` : "/stock")}
          className="w-full lg:w-56"
          aria-label={s.warehouse}
        >
          <option value="">{s.allWarehouses}</option>
          {warehouses.map((w) => (
            <option key={w.value} value={w.value}>
              {w.label}
            </option>
          ))}
        </Select>
      }
      mobileCard={(r) => (
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium text-ink">{r.product}</div>
            <div className="truncate text-[12.5px] text-ink-muted">
              {r.warehouse} · <span dir="ltr">{r.batch ?? "—"}</span>
              {r.expiry && ` · ${formatDate(r.expiry)}`}
            </div>
          </div>
          <div className="text-end">
            <div className="font-semibold" dir="ltr">
              {formatNumber(r.qty)} <span className="text-[11px] font-normal text-ink-muted">{r.unit}</span>
            </div>
            {r.status !== "OK" && <Badge tone={TONE[r.status]}>{label[r.status]}</Badge>}
          </div>
        </div>
      )}
      empty={
        <EmptyState
          icon={<Boxes className="h-5 w-5" />}
          title={s.emptyTitle}
          body={s.emptyBody}
          action={
            warehouseId ? (
              <Link href="/stock" className="text-[14px] font-medium text-brand-700 hover:underline">
                {s.allWarehouses}
              </Link>
            ) : undefined
          }
        />
      }
      emptyFiltered={<EmptyState compact icon={<SearchX className="h-5 w-5" />} title={s.emptyFiltered} />}
    />
  );
}
