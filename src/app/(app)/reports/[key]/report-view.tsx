"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, BarChart3, Download, Printer } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { cn, formatDate, formatMoney, formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import type { ReportData, ReportRow } from "../data";

export function ReportView({
  reportKey,
  title,
  data,
  from,
  to,
  warehouseId,
  warehouseName,
  warehouses,
  canExport,
}: {
  reportKey: string;
  title: string;
  data: ReportData;
  from: string;
  to: string;
  warehouseId: string;
  warehouseName: string | null;
  warehouses: { value: string; label: string }[];
  canExport: boolean;
}) {
  const { dict, t } = useI18n();
  const r = dict.reports;
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);

  const rows = useMemo(() => {
    if (!sort) return data.rows;
    return [...data.rows].sort((a, b) => {
      const x = a[sort.key] ?? "";
      const y = b[sort.key] ?? "";
      return (x > y ? 1 : x < y ? -1 : 0) * sort.dir;
    });
  }, [data.rows, sort]);

  const fmt = (type: string, v: ReportRow[string]) => {
    if (v === null || v === undefined || v === "") return "—";
    switch (type) {
      case "money":
        return formatMoney(Number(v));
      case "number":
        return formatNumber(Number(v));
      case "signed":
        return (Number(v) > 0 ? "+" : "") + formatNumber(Number(v));
      case "date":
        return formatDate(String(v));
      default:
        return String(v);
    }
  };

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      data.columns.map((c) => esc(c.label)).join(","),
      ...rows.map((row) => data.columns.map((c) => esc(row[c.key])).join(",")),
    ].join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    Object.assign(document.createElement("a"), { href: url, download: `zewin-${reportKey}-${from}_${to}.csv` }).click();
    URL.revokeObjectURL(url);
  };

  const numeric = (type: string) => ["money", "number", "signed"].includes(type);
  const totals = data.columns.map((c) =>
    c.type === "money" || (c.type === "number" && !["avgHours"].includes(c.key))
      ? rows.reduce((a, row) => a + (Number(row[c.key]) || 0), 0)
      : null,
  );

  return (
    <div className="space-y-6">
      {/* Filters */}
      <form method="get" className="no-print zw-card flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end">
        {!data.snapshot && (
          <>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-soft">
              {r.from}
              <Input type="date" name="from" defaultValue={from} max={to} className="sm:w-44" />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-soft">
              {r.to}
              <Input type="date" name="to" defaultValue={to} min={from} className="sm:w-44" />
            </label>
          </>
        )}
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-soft">
          {r.warehouse}
          <Select name="wh" defaultValue={warehouseId} className="sm:w-56">
            <option value="">{r.allWarehouses}</option>
            {warehouses.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </Select>
        </label>
        <Button type="submit">{r.apply}</Button>
        <div className="flex gap-2 sm:ms-auto">
          <Button type="button" variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
            {r.print}
          </Button>
          {canExport && (
            <Button type="button" variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportCsv} disabled={!rows.length}>
              {r.export}
            </Button>
          )}
        </div>
      </form>
      {data.snapshot && <p className="no-print -mt-3 text-[12.5px] text-ink-muted">{r.snapshotNote}</p>}

      {/* Print header */}
      <div className="hidden print:block">
        <div className="flex items-end justify-between border-b-2 border-black pb-2">
          <div>
            <div className="text-[20px] font-extrabold tracking-[0.18em]" dir="ltr">ZEWIN</div>
            <div className="text-[12px] font-semibold">{title}</div>
          </div>
          <div className="text-end text-[11px]">
            {!data.snapshot && (
              <div>
                {r.period}: {formatDate(from)} – {formatDate(to)}
              </div>
            )}
            <div>{warehouseName ?? r.allWarehouses}</div>
            <div>{t(r.generated, { date: formatDate(new Date()) })}</div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 print:grid-cols-3">
        {data.kpis.map((k) => (
          <div key={k.label} className="zw-card p-4 sm:p-5 print:border-black print:shadow-none">
            <div className="text-[12.5px] font-medium text-ink-muted">{k.label}</div>
            <div className="mt-1.5 text-[22px] font-semibold tracking-tight tabular" dir="ltr">
              {k.type === "money" ? formatMoney(k.value) : formatNumber(+k.value.toFixed(3))}
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="zw-card overflow-hidden print:border-0 print:shadow-none">
        <div className="no-print flex items-center justify-between border-b border-line px-5 py-3 text-[13px] text-ink-muted">
          <span>{t(r.rows, { n: rows.length })}</span>
          {!data.snapshot && (
            <span>
              {formatDate(from)} – {formatDate(to)}
            </span>
          )}
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={<BarChart3 className="h-5 w-5" />} title={r.noData} body={r.noDataBody} />
        ) : (
          <div className="zw-scroll overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13.5px] print:min-w-0 print:text-[10.5px]">
              <thead>
                <tr className="border-b border-line bg-canvas/60 text-[11.5px] font-semibold uppercase tracking-wide text-ink-muted print:border-black print:bg-white print:text-black">
                  {data.columns.map((c) => (
                    <th key={c.key} className={cn("px-4 py-2.5", numeric(c.type) ? "text-end" : "text-start")}>
                      <button
                        className="no-print-sort inline-flex items-center gap-1 hover:text-ink"
                        onClick={() =>
                          setSort((s) => (s?.key === c.key ? (s.dir === 1 ? { key: c.key, dir: -1 } : null) : { key: c.key, dir: 1 }))
                        }
                      >
                        {c.label}
                        <span className="print:hidden">
                          {sort?.key === c.key ? (
                            sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-40" />
                          )}
                        </span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-line last:border-0 print:border-neutral-300" style={{ breakInside: "avoid" }}>
                    {data.columns.map((c) => (
                      <td
                        key={c.key}
                        dir={numeric(c.type) || c.type === "mono" ? "ltr" : undefined}
                        className={cn(
                          "px-4 py-2.5",
                          numeric(c.type) ? "text-end tabular" : "text-start",
                          c.type === "mono" && "font-mono text-[12.5px] text-ink-soft",
                          c.type === "signed" && Number(row[c.key]) > 0 && "text-emerald-600",
                          c.type === "signed" && Number(row[c.key]) < 0 && "text-red-600",
                          c.type === "money" && "font-medium",
                        )}
                      >
                        {fmt(c.type, row[c.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {totals.some((x) => x !== null) && (
                <tfoot>
                  <tr className="border-t-2 border-line-strong bg-canvas/60 font-semibold print:border-black print:bg-white">
                    {data.columns.map((c, i) => (
                      <td key={c.key} className={cn("px-4 py-2.5", numeric(c.type) ? "text-end tabular" : "")} dir={numeric(c.type) ? "ltr" : undefined}>
                        {i === 0 ? dict.documents.total : totals[i] === null ? "" : c.type === "money" ? formatMoney(totals[i]!) : formatNumber(+totals[i]!.toFixed(3))}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
