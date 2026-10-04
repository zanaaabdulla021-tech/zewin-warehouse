"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Printer, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { archiveWarehouse } from "../actions";
import { useDeleteWarehouse } from "../use-delete-warehouse";

export function DetailActions({
  warehouse,
  perms,
  editIcon,
}: {
  warehouse: { id: string; code: string; name: string; status: string };
  perms: { edit: boolean; delete: boolean };
  editIcon: React.ReactNode;
}) {
  const { dict } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const { askDelete, dialog } = useDeleteWarehouse(() => router.push("/warehouses"));

  return (
    <>
      {perms.edit && (
        <Link href={`/warehouses/${warehouse.id}/edit`}>
          <Button icon={editIcon}>{dict.common.edit}</Button>
        </Link>
      )}
      <DropdownMenu
        label={dict.common.actions}
        trigger={
          <Button variant="secondary" size="icon" aria-label={dict.common.actions}>
            <span className="text-lg leading-none">⋯</span>
          </Button>
        }
        items={[
          { label: dict.common.print, icon: <Printer />, onSelect: () => window.print() },
          {
            label: dict.common.archive,
            icon: <Archive />,
            hidden: !perms.edit || warehouse.status === "ARCHIVED",
            onSelect: async () => {
              const res = await archiveWarehouse(warehouse.id);
              toast(res.ok ? { tone: "success", title: dict.warehouses.archived } : { tone: "error", title: res.message });
              router.refresh();
            },
          },
          "separator",
          { label: dict.common.delete, icon: <Trash2 />, danger: true, hidden: !perms.delete, onSelect: () => askDelete(warehouse) },
        ]}
      />
      {dialog}
    </>
  );
}
