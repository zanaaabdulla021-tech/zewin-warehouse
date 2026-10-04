"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import { Button } from "./button";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  /** value used for sorting and CSV export */
  value?: (row: T) => string | number | null;
  sortable?: boolean;
  align?: "start" | "end";
  className?: string;
};

export type FilterChip = { value: string; label: string; count?: number };

/**
 * Zewin data table: search, filter chips, sorting, pagination, CSV export,
 * row actions. Becomes a card list on mobile (no horizontal scroll).
 */
export function DataTable<T extends { id: string }>({
  rows,
  columns,
  searchText,
  filters,
  filterValue,
  initialQuery,
  filterOf,
  filterMatch,
  rowActions,
  onRowClick,
  mobileCard,
  exportName,
  canExport,
  toolbar,
  empty,
  emptyFiltered,
  pageSize = 10,
}: {
  rows: T[];
  columns: Column<T>[];
  searchText: (row: T) => string;
  filters?: FilterChip[];
  filterValue?: string;
  /** pre-filled search text, e.g. from a ?ref= link */
  initialQuery?: string;
  filterOf?: (row: T) => string;
  /** custom matcher when one row can belong to several chips (e.g. "Low stock") */
  filterMatch?: (row: T, filter: string) => boolean;
  rowActions?: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
  mobileCard: (row: T) => React.ReactNode;
  exportName?: string;
  canExport?: boolean;
  toolbar?: React.ReactNode;
  empty: React.ReactNode;
  emptyFiltered: React.ReactNode;
  pageSize?: number;
}) {
  const { dict, t } = useI18n();
  const [q, setQ] = useState(initialQuery ?? "");
  const [filter, setFilter] = useState(filterValue ?? "all");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);

  const processed = useMemo(() => {
    const s = q.trim().toLowerCase();
    let out = rows.filter(
      (r) => (!s || searchText(r).toLowerCase().includes(s)) && (filter === "all" || (filterMatch ? filterMatch(r, filter) : !filterOf || filterOf(r) === filter)),
    );
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.value) {
        out = [...out].sort((a, b) => {
          const va = col.value!(a) ?? "";
          const vb = col.value!(b) ?? "";
          return (va > vb ? 1 : va < vb ? -1 : 0) * sort.dir;
        });
      }
    }
    return out;
  }, [rows, q, filter, sort, columns, searchText, filterOf, filterMatch]);

  const pages = Math.max(1, Math.ceil(processed.length / pageSize));
  const current = Math.min(page, pages - 1);
  const slice = processed.slice(current * pageSize, current * pageSize + pageSize);

  const exportCsv = () => {
    const cols = columns.filter((c) => c.value);
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.map((c) => esc(c.header)).join(","), ...processed.map((r) => cols.map((c) => esc(c.value!(r))).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${exportName ?? "export"}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  if (rows.length === 0) return <div className="zw-card">{empty}</div>;

  return (
    <div className="zw-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-xs">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder={dict.common.search}
            className="zw-field ps-9"
            aria-label={dict.common.search}
          />
        </div>
        {filters && (
          <div className="zw-scroll -mx-1 flex gap-1 overflow-x-auto px-1">
            {[{ value: "all", label: dict.common.all, count: rows.length }, ...filters].map((f) => (
              <button
                key={f.value}
                onClick={() => {
                  setFilter(f.value);
                  setPage(0);
                }}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors",
                  filter === f.value ? "bg-ink text-white" : "text-ink-soft hover:bg-canvas",
                )}
              >
                {f.label}
                {f.count !== undefined && (
                  <span className={cn("text-[12px]", filter === f.value ? "text-white/70" : "text-ink-faint")}>{f.count}</span>
                )}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 lg:ms-auto">
          {toolbar}
          {canExport && (
            <Button variant="secondary" size="md" icon={<Download className="h-4 w-4" />} onClick={exportCsv}>
              {dict.common.export}
            </Button>
          )}
        </div>
      </div>

      {processed.length === 0 ? (
        emptyFiltered
      ) : (
        <>
          {/* Desktop table */}
          <table className="hidden w-full text-[14px] md:table">
            <thead>
              <tr className="border-b border-line bg-canvas/60">
                {columns.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    className={cn(
                      "px-5 py-3 text-[12px] font-semibold uppercase tracking-wide text-ink-muted",
                      c.align === "end" ? "text-end" : "text-start",
                      c.className,
                    )}
                  >
                    {c.sortable && c.value ? (
                      <button
                        className="inline-flex items-center gap-1 hover:text-ink"
                        onClick={() =>
                          setSort((s) => (s?.key === c.key ? (s.dir === 1 ? { key: c.key, dir: -1 } : null) : { key: c.key, dir: 1 }))
                        }
                      >
                        {c.header}
                        {sort?.key === c.key ? (
                          sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                ))}
                {rowActions && <th className="w-12" aria-label={dict.common.actions} />}
              </tr>
            </thead>
            <tbody>
              {slice.map((r) => (
                <tr
                  key={r.id}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  className={cn(
                    "border-b border-line last:border-0 transition-colors",
                    onRowClick && "cursor-pointer hover:bg-canvas/70",
                  )}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-5 py-3.5", c.align === "end" && "text-end", c.className)}>
                      {c.cell(r)}
                    </td>
                  ))}
                  {rowActions && (
                    <td className="px-3 text-end" onClick={(e) => e.stopPropagation()}>
                      {rowActions(r)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile cards */}
          <ul className="divide-y divide-line md:hidden">
            {slice.map((r) => (
              <li key={r.id} className="flex items-start gap-3 px-4 py-4">
                <div
                  className={cn("min-w-0 flex-1", onRowClick && "cursor-pointer")}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                >
                  {mobileCard(r)}
                </div>
                {rowActions?.(r)}
              </li>
            ))}
          </ul>

          {/* Pagination */}
          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-[13px] text-ink-muted">
            <span>
              {t(dict.common.showing, {
                from: current * pageSize + 1,
                to: Math.min((current + 1) * pageSize, processed.length),
                total: processed.length,
              })}
            </span>
            <div className="flex gap-1">
              <Button
                variant="secondary"
                size="icon"
                aria-label={dict.common.previous}
                disabled={current === 0}
                onClick={() => setPage(current - 1)}
              >
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                aria-label={dict.common.next}
                disabled={current >= pages - 1}
                onClick={() => setPage(current + 1)}
              >
                <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
