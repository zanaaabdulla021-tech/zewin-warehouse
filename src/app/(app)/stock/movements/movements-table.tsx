"use client";

import Link from "next/link";
import { ArrowRight, History, SearchX } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { cn, formatDate, formatMoney, formatNumber, formatTime } from "@/lib/utils";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export type MovementRow = {
  id: string;
  at: string;
  reference: string | null;
  type: "STOCK_IN" | "STOCK_OUT" | "TRANSFER_IN" | "TRANSFER_OUT" | "ADJUSTMENT" | "RETURN";
  productId: string;
  product: string;
  code: string;
  unit: string;
  batch: string | null;
  warehouse: string;
  counterpart: string | null;
  qty: number;
  value: number;
  by: string | null;
  note: string | null;
};

const TONE: Record<MovementRow["type"], BadgeTone> = {
  STOCK_IN: "green",
  TRANSFER_IN: "blue",
  STOCK_OUT: "red",
  TRANSFER_OUT: "blue",
  ADJUSTMENT: "yellow",
  RETURN: "gray",
};

export function MovementsTable({ rows, initialQuery, canExport }: { rows: MovementRow[]; initialQuery?: string; canExport: boolean }) {
  const { dict } = useI18n();
  const s = dict.stock;

  const qty = (r: MovementRow) => (
    <span className={cn("font-semibold tabular", r.qty > 0 ? "text-emerald-600" : "text-red-600")} dir="ltr">
      {r.qty > 0 ? "+" : ""}
      {formatNumber(r.qty)} <span className="text-[12px] font-normal text-ink-muted">{r.unit}</span>
    </span>
  );

  const columns: Column<MovementRow>[] = [
    {
      key: "at",
      header: s.date,
      sortable: true,
      value: (r) => r.at,
      cell: (r) => (
        <div className="whitespace-nowrap">
          <div className="text-[13.5px] text-ink">{formatDate(r.at)}</div>
          <div className="text-[12px] text-ink-muted">{formatTime(r.at)}</div>
        </div>
      ),
    },
    {
      key: "reference",
      header: s.reference,
      sortable: true,
      value: (r) => r.reference ?? "",
      cell: (r) => (
        <div>
          <div className="font-mono text-[13px] font-medium text-ink" dir="ltr">{r.reference ?? "—"}</div>
          <Badge tone={TONE[r.type]} dot={false} className="mt-1">
            {s.movementTypes[r.type]}
          </Badge>
        </div>
      ),
    },
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
          <span className="font-mono text-[12px] text-ink-muted" dir="ltr">
            {r.code}
            {r.batch && ` · ${r.batch}`}
          </span>
        </div>
      ),
    },
    {
      key: "warehouse",
      header: s.warehouse,
      sortable: true,
      value: (r) => r.warehouse,
      cell: (r) => (
        <div className="text-[13.5px] text-ink-soft">
          {r.warehouse}
          {r.counterpart && (
            <div className="flex items-center gap-1 text-[12px] text-ink-muted">
              <ArrowRight className={cn("h-3 w-3", r.type === "TRANSFER_IN" ? "rotate-180 rtl:rotate-0" : "rtl:rotate-180")} />
              {r.counterpart}
            </div>
          )}
        </div>
      ),
    },
    { key: "qty", header: s.quantity, sortable: true, align: "end", value: (r) => r.qty, cell: qty },
    {
      key: "value",
      header: s.value,
      sortable: true,
      align: "end",
      value: (r) => +r.value.toFixed(2),
      cell: (r) => <span className="text-ink-soft" dir="ltr">{formatMoney(Math.abs(r.value))}</span>,
    },
    { key: "by", header: s.by, value: (r) => r.by ?? "", cell: (r) => <span className="text-[13px] text-ink-muted">{r.by ?? "—"}</span> },
  ];

  const types = Object.keys(s.movementTypes) as MovementRow["type"][];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      pageSize={20}
      initialQuery={initialQuery}
      searchText={(r) => `${r.reference ?? ""} ${r.product} ${r.code} ${r.batch ?? ""} ${r.warehouse} ${r.counterpart ?? ""} ${r.by ?? ""} ${r.note ?? ""}`}
      filters={types
        .map((tp) => ({ value: tp, label: s.movementTypes[tp], count: rows.filter((r) => r.type === tp).length }))
        .filter((f) => f.count > 0)}
      filterOf={(r) => r.type}
      canExport={canExport}
      exportName="stock-movements"
      mobileCard={(r) => (
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium text-ink">{r.product}</span>
            </div>
            <div className="mt-0.5 text-[12.5px] text-ink-muted">
              <span className="font-mono" dir="ltr">{r.reference}</span> · {s.movementTypes[r.type]} · {r.warehouse}
            </div>
            <div className="text-[12px] text-ink-faint">
              {formatDate(r.at)} {formatTime(r.at)}
            </div>
          </div>
          {qty(r)}
        </div>
      )}
      empty={<EmptyState icon={<History className="h-5 w-5" />} title={s.movementsEmpty} body={s.movementsEmptyBody} />}
      emptyFiltered={<EmptyState compact icon={<SearchX className="h-5 w-5" />} title={s.emptyFiltered} />}
    />
  );
}
