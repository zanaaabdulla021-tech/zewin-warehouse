"use client";

import { History, SearchX } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { formatDate, formatTime, initials } from "@/lib/utils";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export type AuditRow = {
  id: string;
  at: string;
  user: string;
  action: string;
  module: string;
  record: string | null;
  details: string | null;
};

const TONE: Record<string, BadgeTone> = {
  created: "green",
  edited: "blue",
  deleted: "red",
  archived: "gray",
  verified: "green",
  rejected: "red",
  approved: "green",
  exported: "gray",
};

export function AuditTable({ rows, canExport }: { rows: AuditRow[]; canExport: boolean }) {
  const { dict } = useI18n();
  const s = dict.settings;
  const action = (a: string) => dict.audit[a as keyof typeof dict.audit] ?? a;
  const mod = (m: string) => dict.nav[m as keyof typeof dict.nav] ?? m;

  const columns: Column<AuditRow>[] = [
    {
      key: "at",
      header: s.auditWhen,
      sortable: true,
      value: (r) => r.at,
      cell: (r) => (
        <div className="whitespace-nowrap">
          <div className="text-[13.5px]">{formatDate(r.at)}</div>
          <div className="text-[12px] text-ink-muted">{formatTime(r.at)}</div>
        </div>
      ),
    },
    {
      key: "user",
      header: s.auditUser,
      sortable: true,
      value: (r) => r.user,
      cell: (r) => (
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-canvas text-[11px] font-semibold ring-1 ring-line">
            {initials(r.user)}
          </span>
          {r.user}
        </div>
      ),
    },
    { key: "action", header: s.auditAction, value: (r) => action(r.action), cell: (r) => <Badge tone={TONE[r.action] ?? "gray"} dot={false}>{action(r.action)}</Badge> },
    { key: "module", header: s.auditModule, sortable: true, value: (r) => mod(r.module), cell: (r) => <span className="text-ink-soft">{mod(r.module)}</span> },
    {
      key: "record",
      header: s.auditRecord,
      value: (r) => r.record ?? "",
      cell: (r) => <span className="font-mono text-[13px] font-medium text-brand-700" dir="ltr">{r.record ?? "—"}</span>,
    },
    {
      key: "details",
      header: s.auditDetails,
      value: (r) => r.details ?? "",
      cell: (r) => <span className="line-clamp-2 max-w-xs font-mono text-[11.5px] text-ink-muted" dir="ltr">{r.details ?? ""}</span>,
    },
  ];

  const modules = [...new Set(rows.map((r) => r.module))];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      pageSize={25}
      searchText={(r) => `${r.user} ${action(r.action)} ${mod(r.module)} ${r.record ?? ""} ${r.details ?? ""}`}
      filters={modules.map((m) => ({ value: m, label: mod(m), count: rows.filter((r) => r.module === m).length }))}
      filterOf={(r) => r.module}
      canExport={canExport}
      exportName="audit-log"
      mobileCard={(r) => (
        <div className="text-[13.5px]">
          <div>
            <strong className="font-semibold">{r.user}</strong> <span className="text-ink-muted">{action(r.action)}</span> {mod(r.module)}{" "}
            <span className="font-mono text-brand-700" dir="ltr">{r.record}</span>
          </div>
          <div className="text-[12px] text-ink-faint">
            {formatDate(r.at)} · {formatTime(r.at)}
          </div>
        </div>
      )}
      empty={<EmptyState icon={<History className="h-5 w-5" />} title={s.auditEmpty} />}
      emptyFiltered={<EmptyState compact icon={<SearchX className="h-5 w-5" />} title={dict.common.noResults} />}
    />
  );
}
