"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, FileText, Pencil, Plus, Printer, SearchX, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { formatDate, formatMoney } from "@/lib/utils";
import { isEditable } from "@/lib/documents";
import { PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useDeleteDocument } from "./use-delete-document";

type Status = "DRAFT" | "PENDING" | "PROCESSING" | "VERIFIED" | "REJECTED" | "ARCHIVED";
type Type = "PURCHASE" | "TRANSFER" | "STOCK_IN" | "STOCK_OUT" | "ADJUSTMENT" | "RETURN" | "OTHER";

export type DocRow = {
  id: string;
  number: string;
  type: Type;
  status: Status;
  date: string;
  warehouse: string;
  party: string | null;
  isTransfer: boolean;
  referenceNumber: string | null;
  items: number;
  total: number;
  currency: string;
  createdBy: string;
  /** created by the current user */
  mine: boolean;
};

export function DocumentList({
  rows,
  initialStatus,
  perms,
}: {
  rows: DocRow[];
  initialStatus?: string;
  perms: { create: boolean; edit: boolean; delete: boolean; export: boolean; own: boolean };
}) {
  const { dict } = useI18n();
  const d = dict.documents;
  const router = useRouter();
  const { askDelete, dialog } = useDeleteDocument();

  const addBtn = perms.create && (
    <Link href="/documents/new">
      <Button icon={<Plus className="h-4 w-4" />}>{d.new}</Button>
    </Link>
  );

  const columns: Column<DocRow>[] = [
    {
      key: "number",
      header: d.colNumber,
      sortable: true,
      value: (r) => r.number,
      cell: (r) => (
        <div>
          <Link href={`/documents/${r.id}`} className="font-mono text-[13.5px] font-semibold text-ink hover:text-brand-700" dir="ltr">
            {r.number}
          </Link>
          {r.referenceNumber && <div className="text-[12px] text-ink-muted">{r.referenceNumber}</div>}
        </div>
      ),
    },
    {
      key: "type",
      header: d.colType,
      sortable: true,
      value: (r) => dict.docType[r.type],
      cell: (r) => (
        <Badge tone="brand" dot={false}>
          {dict.docType[r.type]}
        </Badge>
      ),
    },
    { key: "date", header: d.colDate, sortable: true, value: (r) => r.date, cell: (r) => <span className="text-ink-soft">{formatDate(r.date)}</span> },
    {
      key: "warehouse",
      header: d.warehouse,
      sortable: true,
      value: (r) => r.warehouse,
      cell: (r) => (
        <div className="text-[13.5px]">
          <div className="text-ink-soft">{r.warehouse}</div>
          {r.party && (
            <div className="flex items-center gap-1 text-[12px] text-ink-muted">
              {r.isTransfer && <ArrowRight className="h-3 w-3 rtl:rotate-180" />}
              {r.party}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "total",
      header: d.colTotal,
      sortable: true,
      align: "end",
      value: (r) => r.total,
      cell: (r) => (
        <div className="text-end">
          <div className="font-semibold" dir="ltr">{formatMoney(r.total, r.currency)}</div>
          <div className="text-[12px] text-ink-muted">
            {r.items} {d.items.toLowerCase()}
          </div>
        </div>
      ),
    },
    { key: "status", header: dict.common.status, value: (r) => r.status, cell: (r) => <StatusBadge status={r.status} label={dict.status[r.status]} /> },
  ];

  const statuses: Status[] = ["DRAFT", "PENDING", "VERIFIED", "REJECTED"];

  return (
    <>
      <PageHeader title={d.title} description={d.subtitle} actions={addBtn} />
      <DataTable
        rows={rows}
        columns={columns}
        pageSize={15}
        filterValue={initialStatus && statuses.includes(initialStatus as Status) ? initialStatus : undefined}
        searchText={(r) => `${r.number} ${r.referenceNumber ?? ""} ${r.warehouse} ${r.party ?? ""} ${dict.docType[r.type]} ${r.createdBy}`}
        filters={statuses.map((s) => ({ value: s, label: dict.status[s], count: rows.filter((r) => r.status === s).length }))}
        filterOf={(r) => r.status}
        onRowClick={(r) => router.push(`/documents/${r.id}`)}
        canExport={perms.export}
        exportName="documents"
        rowActions={(r) => (
          <DropdownMenu
            items={[
              { label: dict.common.view, icon: <Eye />, onSelect: () => router.push(`/documents/${r.id}`) },
              { label: dict.common.edit, icon: <Pencil />, hidden: !(perms.edit || (perms.own && r.mine)) || !isEditable(r.status), onSelect: () => router.push(`/documents/${r.id}/edit`) },
              { label: d.print, icon: <Printer />, onSelect: () => window.open(`/print/documents/${r.id}`, "_blank") },
              "separator",
              { label: dict.common.delete, icon: <Trash2 />, danger: true, hidden: !(perms.delete || (perms.own && r.mine)) || !isEditable(r.status), onSelect: () => askDelete(r) },
            ]}
          />
        )}
        mobileCard={(r) => (
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[13.5px] font-semibold" dir="ltr">{r.number}</div>
              <div className="truncate text-[12.5px] text-ink-muted">
                {dict.docType[r.type]} · {r.warehouse} · {formatDate(r.date)}
              </div>
            </div>
            <div className="text-end">
              <div className="text-[14px] font-semibold" dir="ltr">{formatMoney(r.total, r.currency)}</div>
              <StatusBadge status={r.status} label={dict.status[r.status]} />
            </div>
          </div>
        )}
        empty={<EmptyState icon={<FileText className="h-5 w-5" />} title={d.emptyTitle} body={d.emptyBody} action={addBtn} />}
        emptyFiltered={<EmptyState compact icon={<SearchX className="h-5 w-5" />} title={d.emptyFiltered} />}
      />
      {dialog}
    </>
  );
}
