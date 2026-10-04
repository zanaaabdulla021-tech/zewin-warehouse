"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, FilePlus2, Pencil, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { archiveSupplier } from "../actions";
import { useDeleteSupplier } from "../supplier-list";

export function SupplierDetailActions({
  supplier,
  perms,
}: {
  supplier: { id: string; name: string; status: string };
  perms: { edit: boolean; delete: boolean; purchase: boolean };
}) {
  const { dict } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const { askDelete, dialog } = useDeleteSupplier(() => router.push("/suppliers"));
  return (
    <>
      {perms.purchase && (
        <Link href="/documents/new?type=PURCHASE">
          <Button icon={<FilePlus2 className="h-4 w-4" />}>{dict.suppliers.newPurchase}</Button>
        </Link>
      )}
      {perms.edit && (
        <Link href={`/suppliers/${supplier.id}/edit`}>
          <Button variant="secondary" icon={<Pencil className="h-4 w-4" />}>
            {dict.common.edit}
          </Button>
        </Link>
      )}
      <DropdownMenu
        trigger={
          <Button variant="secondary" size="icon" aria-label={dict.common.actions}>
            <span className="text-lg leading-none">⋯</span>
          </Button>
        }
        items={[
          {
            label: dict.common.archive,
            icon: <Archive />,
            hidden: !perms.edit || supplier.status === "ARCHIVED",
            onSelect: async () => {
              const res = await archiveSupplier(supplier.id);
              toast(res.ok ? { tone: "success", title: dict.suppliers.archived } : { tone: "error", title: res.message });
              router.refresh();
            },
          },
          { label: dict.common.delete, icon: <Trash2 />, danger: true, hidden: !perms.delete, onSelect: () => askDelete(supplier) },
        ]}
      />
      {dialog}
    </>
  );
}
