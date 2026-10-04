"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, SearchX, UserCheck, UserX, Users } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { formatDate, initials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { setEmployeeStatus } from "./actions";

export type EmployeeRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  roleKey: string;
  warehouses: string[];
  status: "ACTIVE" | "INACTIVE";
  lastActivity: string | null;
  isMe: boolean;
};

export function EmployeeList({
  rows,
  perms,
  isSuperAdmin,
}: {
  rows: EmployeeRow[];
  perms: { create: boolean; edit: boolean; export: boolean };
  isSuperAdmin: boolean;
}) {
  const { dict, t } = useI18n();
  const e = dict.employees;
  const router = useRouter();
  const toast = useToast();
  const [target, setTarget] = useState<EmployeeRow | null>(null);
  const [busy, start] = useTransition();

  const toggle = (r: EmployeeRow, active: boolean) =>
    start(async () => {
      const res = await setEmployeeStatus(r.id, active);
      setTarget(null);
      toast(res.ok ? { tone: "success", title: active ? e.activated : e.deactivated } : { tone: "error", title: res.message });
      router.refresh();
    });

  const editable = (r: EmployeeRow) => perms.edit && (r.roleKey !== "SUPER_ADMIN" || isSuperAdmin);

  const columns: Column<EmployeeRow>[] = [
    {
      key: "name",
      header: e.colEmployee,
      sortable: true,
      value: (r) => r.name,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-[12px] font-semibold text-white">
            {initials(r.name)}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium text-ink">{r.name}</span>
              {r.isMe && <Badge tone="brand" dot={false}>{e.you}</Badge>}
            </div>
            <div className="truncate text-[12.5px] text-ink-muted" dir="ltr">{r.email}</div>
          </div>
        </div>
      ),
    },
    { key: "role", header: e.colRole, sortable: true, value: (r) => r.role, cell: (r) => <span className="text-ink-soft">{r.role}</span> },
    {
      key: "warehouses",
      header: e.colWarehouses,
      value: (r) => r.warehouses.join(", "),
      cell: (r) =>
        r.warehouses.length ? (
          <div className="flex flex-wrap gap-1">
            {r.warehouses.slice(0, 2).map((w) => (
              <Badge key={w} tone="gray" dot={false}>
                {w}
              </Badge>
            ))}
            {r.warehouses.length > 2 && <Badge tone="gray" dot={false}>+{r.warehouses.length - 2}</Badge>}
          </div>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
    {
      key: "last",
      header: dict.common.lastUpdated,
      sortable: true,
      value: (r) => r.lastActivity ?? "",
      cell: (r) => <span className="text-[13px] text-ink-muted">{r.lastActivity ? formatDate(r.lastActivity) : "—"}</span>,
    },
    { key: "status", header: dict.common.status, value: (r) => r.status, cell: (r) => <StatusBadge status={r.status} label={dict.status[r.status]} /> },
  ];

  const addBtn = perms.create && (
    <Link href="/employees/new">
      <Button icon={<Plus className="h-4 w-4" />}>{e.add}</Button>
    </Link>
  );

  return (
    <>
      <DataTable
        rows={rows}
        columns={columns}
        searchText={(r) => `${r.name} ${r.email} ${r.phone ?? ""} ${r.role} ${r.warehouses.join(" ")}`}
        filters={(["ACTIVE", "INACTIVE"] as const).map((s) => ({ value: s, label: dict.status[s], count: rows.filter((r) => r.status === s).length }))}
        filterOf={(r) => r.status}
        onRowClick={(r) => editable(r) && router.push(`/employees/${r.id}/edit`)}
        canExport={perms.export}
        exportName="employees"
        rowActions={(r) => (
          <DropdownMenu
            items={[
              { label: dict.common.edit, icon: <Pencil />, hidden: !editable(r), onSelect: () => router.push(`/employees/${r.id}/edit`) },
              { label: e.activate, icon: <UserCheck />, hidden: !editable(r) || r.isMe || r.status === "ACTIVE", onSelect: () => toggle(r, true) },
              "separator",
              { label: e.deactivate, icon: <UserX />, danger: true, hidden: !editable(r) || r.isMe || r.status !== "ACTIVE", onSelect: () => setTarget(r) },
            ]}
          />
        )}
        mobileCard={(r) => (
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[12px] font-semibold text-white">
              {initials(r.name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{r.name}</div>
              <div className="truncate text-[12.5px] text-ink-muted">{r.role}</div>
            </div>
            <StatusBadge status={r.status} label={dict.status[r.status]} />
          </div>
        )}
        empty={<EmptyState icon={<Users className="h-5 w-5" />} title={e.emptyTitle} body={e.emptyBody} action={addBtn} />}
        emptyFiltered={<EmptyState compact icon={<SearchX className="h-5 w-5" />} title={e.emptyFiltered} />}
      />
      <ConfirmDialog
        open={!!target}
        onClose={() => setTarget(null)}
        loading={busy}
        title={t(e.deactivateTitle, { name: target?.name ?? "" })}
        body={e.deactivateBody}
        confirmLabel={e.deactivate}
        cancelLabel={dict.common.cancel}
        onConfirm={() => toggle(target!, false)}
      />
    </>
  );
}
