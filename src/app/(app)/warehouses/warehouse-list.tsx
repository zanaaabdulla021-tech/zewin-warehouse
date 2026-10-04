"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Eye, MapPin, Pencil, Plus, Trash2, Warehouse as WarehouseIcon, SearchX } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { formatMoney, formatNumber } from "@/lib/utils";
import { PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import type { ComboOption } from "@/components/ui/combobox";
import { AddWarehouseModal } from "./add-warehouse-modal";
import { useDeleteWarehouse } from "./use-delete-warehouse";
import { archiveWarehouse } from "./actions";

export type WarehouseRow = {
  id: string;
  code: string;
  name: string;
  type: "MAIN" | "BRANCH" | "COLD_STORAGE" | "TRANSIT";
  city: string | null;
  address: string | null;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  manager: string | null;
  employees: number;
  products: number;
  value: number;
};

export function WarehouseList({
  rows,
  managers,
  nextCode,
  openNew,
  perms,
}: {
  rows: WarehouseRow[];
  managers: ComboOption[];
  nextCode: string;
  openNew: boolean;
  perms: { create: boolean; edit: boolean; delete: boolean; export: boolean };
}) {
  const { dict } = useI18n();
  const w = dict.warehouses;
  const router = useRouter();
  const toast = useToast();
  const [modal, setModal] = useState(openNew && perms.create);
  const { askDelete, dialog } = useDeleteWarehouse();

  const addBtn = perms.create && (
    <Button icon={<Plus className="h-4 w-4" />} onClick={() => setModal(true)}>
      {w.add}
    </Button>
  );

  const columns: Column<WarehouseRow>[] = [
    {
      key: "name",
      header: w.colWarehouse,
      sortable: true,
      value: (r) => r.name,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <WarehouseIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <Link href={`/warehouses/${r.id}`} className="block truncate font-medium text-ink hover:text-brand-700">
              {r.name}
            </Link>
            <span className="font-mono text-[12px] text-ink-muted" dir="ltr">
              {r.code}
            </span>
            <span className="text-[12px] text-ink-faint"> · {w.types[r.type]}</span>
          </div>
        </div>
      ),
    },
    { key: "city", header: w.colLocation, sortable: true, value: (r) => r.city ?? "", cell: (r) => <span className="text-ink-soft">{r.city ?? "—"}</span> },
    {
      key: "manager",
      header: w.colManager,
      sortable: true,
      value: (r) => r.manager ?? "",
      cell: (r) => (r.manager ? <span className="text-ink-soft">{r.manager}</span> : <span className="text-ink-faint">{w.unassigned}</span>),
    },
    { key: "products", header: w.colProducts, sortable: true, align: "end", value: (r) => r.products, cell: (r) => formatNumber(r.products) },
    {
      key: "value",
      header: w.colValue,
      sortable: true,
      align: "end",
      value: (r) => r.value,
      cell: (r) => <span className="font-medium" dir="ltr">{formatMoney(r.value)}</span>,
    },
    { key: "status", header: w.colStatus, value: (r) => r.status, cell: (r) => <StatusBadge status={r.status} label={dict.status[r.status]} /> },
  ];

  const counts = (s: WarehouseRow["status"]) => rows.filter((r) => r.status === s).length;

  return (
    <>
      <PageHeader title={w.title} description={w.subtitle} actions={addBtn} />

      <DataTable
        rows={rows}
        columns={columns}
        searchText={(r) => `${r.name} ${r.code} ${r.city ?? ""} ${r.manager ?? ""}`}
        filters={(["ACTIVE", "INACTIVE", "ARCHIVED"] as const).map((s) => ({ value: s, label: dict.status[s], count: counts(s) }))}
        filterOf={(r) => r.status}
        onRowClick={(r) => router.push(`/warehouses/${r.id}`)}
        canExport={perms.export}
        exportName="warehouses"
        rowActions={(r) => (
          <DropdownMenu
            label={dict.common.actions}
            items={[
              { label: dict.common.view, icon: <Eye />, onSelect: () => router.push(`/warehouses/${r.id}`) },
              { label: dict.common.edit, icon: <Pencil />, onSelect: () => router.push(`/warehouses/${r.id}/edit`), hidden: !perms.edit },
              {
                label: dict.common.archive,
                icon: <Archive />,
                hidden: !perms.edit || r.status === "ARCHIVED",
                onSelect: async () => {
                  const res = await archiveWarehouse(r.id);
                  toast(res.ok ? { tone: "success", title: w.archived } : { tone: "error", title: res.message });
                  router.refresh();
                },
              },
              "separator",
              { label: dict.common.delete, icon: <Trash2 />, danger: true, hidden: !perms.delete, onSelect: () => askDelete(r) },
            ]}
          />
        )}
        mobileCard={(r) => (
          <div>
            <div className="flex items-center gap-2">
              <span className="truncate font-medium text-ink">{r.name}</span>
              <StatusBadge status={r.status} label={dict.status[r.status]} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-muted">
              <span className="font-mono" dir="ltr">{r.code}</span>
              {r.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {r.city}
                </span>
              )}
              <span dir="ltr">{formatMoney(r.value)}</span>
            </div>
          </div>
        )}
        empty={
          <EmptyState
            icon={<WarehouseIcon className="h-5 w-5" />}
            title={w.emptyTitle}
            body={w.emptyBody}
            action={addBtn}
          />
        }
        emptyFiltered={<EmptyState compact icon={<SearchX className="h-5 w-5" />} title={w.emptyFiltered} body={w.emptyFilteredBody} />}
      />

      <AddWarehouseModal
        key={nextCode}
        open={modal}
        onClose={() => {
          setModal(false);
          if (openNew) router.replace("/warehouses");
        }}
        nextCode={nextCode}
        managers={managers}
      />
      {dialog}
    </>
  );
}
