"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Eye, Pencil, Phone, Plus, SearchX, Trash2, Truck } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { formatMoney, formatNumber } from "@/lib/utils";
import { PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { archiveSupplier, deleteSupplier } from "./actions";

export type SupplierRow = {
  id: string;
  code: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  city: string | null;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  documents: number;
  purchased: number;
};

export function useDeleteSupplier(after?: () => void) {
  const { dict } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const [busy, start] = useTransition();
  const dialog = (
    <ConfirmDialog
      open={!!target}
      onClose={() => setTarget(null)}
      loading={busy}
      title={dict.suppliers.deleteTitle}
      body={
        <p>
          <strong className="text-ink">{target?.name}</strong> — {dict.common.deleteBody}
        </p>
      }
      confirmLabel={dict.common.delete}
      cancelLabel={dict.common.cancel}
      onConfirm={() =>
        start(async () => {
          const res = await deleteSupplier(target!.id);
          setTarget(null);
          toast(res.ok ? { tone: "success", title: dict.suppliers.deleted } : { tone: "error", title: res.message });
          if (res.ok) (after ? after() : router.refresh());
        })
      }
    />
  );
  return { askDelete: setTarget, dialog };
}

export function SupplierList({
  rows,
  perms,
}: {
  rows: SupplierRow[];
  perms: { create: boolean; edit: boolean; delete: boolean; export: boolean };
}) {
  const { dict } = useI18n();
  const s = dict.suppliers;
  const router = useRouter();
  const toast = useToast();
  const { askDelete, dialog } = useDeleteSupplier();

  const addBtn = perms.create && (
    <Link href="/suppliers/new">
      <Button icon={<Plus className="h-4 w-4" />}>{s.add}</Button>
    </Link>
  );

  const columns: Column<SupplierRow>[] = [
    {
      key: "name",
      header: s.colSupplier,
      sortable: true,
      value: (r) => r.name,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Truck className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <Link href={`/suppliers/${r.id}`} className="block truncate font-medium text-ink hover:text-brand-700">
              {r.name}
            </Link>
            <span className="font-mono text-[12px] text-ink-muted" dir="ltr">{r.code}</span>
          </div>
        </div>
      ),
    },
    {
      key: "contact",
      header: s.colContact,
      value: (r) => r.contactName ?? r.phone ?? "",
      cell: (r) => (
        <div className="text-[13.5px]">
          <div className="text-ink-soft">{r.contactName ?? "—"}</div>
          {r.phone && <div className="text-[12px] text-ink-muted" dir="ltr">{r.phone}</div>}
        </div>
      ),
    },
    { key: "city", header: s.city, sortable: true, value: (r) => r.city ?? "", cell: (r) => <span className="text-ink-soft">{r.city ?? "—"}</span> },
    { key: "documents", header: s.colDocs, sortable: true, align: "end", value: (r) => r.documents, cell: (r) => formatNumber(r.documents) },
    {
      key: "purchased",
      header: s.colPurchased,
      sortable: true,
      align: "end",
      value: (r) => r.purchased,
      cell: (r) => <span className="font-medium" dir="ltr">{formatMoney(r.purchased)}</span>,
    },
    { key: "status", header: dict.common.status, value: (r) => r.status, cell: (r) => <StatusBadge status={r.status} label={dict.status[r.status]} /> },
  ];

  return (
    <>
      <PageHeader title={s.title} description={s.subtitle} actions={addBtn} />
      <DataTable
        rows={rows}
        columns={columns}
        searchText={(r) => `${r.name} ${r.code} ${r.contactName ?? ""} ${r.phone ?? ""} ${r.city ?? ""}`}
        filters={(["ACTIVE", "INACTIVE", "ARCHIVED"] as const).map((st) => ({
          value: st,
          label: dict.status[st],
          count: rows.filter((r) => r.status === st).length,
        }))}
        filterOf={(r) => r.status}
        onRowClick={(r) => router.push(`/suppliers/${r.id}`)}
        canExport={perms.export}
        exportName="suppliers"
        rowActions={(r) => (
          <DropdownMenu
            items={[
              { label: dict.common.view, icon: <Eye />, onSelect: () => router.push(`/suppliers/${r.id}`) },
              { label: dict.common.edit, icon: <Pencil />, hidden: !perms.edit, onSelect: () => router.push(`/suppliers/${r.id}/edit`) },
              {
                label: dict.common.archive,
                icon: <Archive />,
                hidden: !perms.edit || r.status === "ARCHIVED",
                onSelect: async () => {
                  const res = await archiveSupplier(r.id);
                  toast(res.ok ? { tone: "success", title: s.archived } : { tone: "error", title: res.message });
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
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-ink">{r.name}</div>
              <div className="flex items-center gap-2 text-[12.5px] text-ink-muted">
                <span className="font-mono" dir="ltr">{r.code}</span>
                {r.phone && (
                  <span className="inline-flex items-center gap-1" dir="ltr">
                    <Phone className="h-3 w-3" />
                    {r.phone}
                  </span>
                )}
              </div>
            </div>
            <div className="text-end text-[13.5px] font-semibold" dir="ltr">{formatMoney(r.purchased)}</div>
          </div>
        )}
        empty={<EmptyState icon={<Truck className="h-5 w-5" />} title={s.emptyTitle} body={s.emptyBody} action={addBtn} />}
        emptyFiltered={<EmptyState compact icon={<SearchX className="h-5 w-5" />} title={s.emptyFiltered} />}
      />
      {dialog}
    </>
  );
}
