"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Pencil, Printer, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { archiveProduct } from "../actions";
import { useDeleteProduct } from "../use-delete-product";

export function ProductDetailActions({
  product,
  perms,
}: {
  product: { id: string; code: string; name: string; status: string };
  perms: { edit: boolean; delete: boolean };
}) {
  const { dict } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const { askDelete, dialog } = useDeleteProduct(() => router.push("/products"));
  return (
    <>
      {perms.edit && (
        <Link href={`/products/${product.id}/edit`}>
          <Button icon={<Pencil className="h-4 w-4" />}>{dict.common.edit}</Button>
        </Link>
      )}
      <DropdownMenu
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
            hidden: !perms.edit || product.status === "ARCHIVED",
            onSelect: async () => {
              const res = await archiveProduct(product.id);
              toast(res.ok ? { tone: "success", title: dict.products.archived } : { tone: "error", title: res.message });
              router.refresh();
            },
          },
          "separator",
          { label: dict.common.delete, icon: <Trash2 />, danger: true, hidden: !perms.delete, onSelect: () => askDelete(product) },
        ]}
      />
      {dialog}
    </>
  );
}
