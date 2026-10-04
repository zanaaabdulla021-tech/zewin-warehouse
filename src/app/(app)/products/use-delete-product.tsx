"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteProduct } from "./actions";

export function useDeleteProduct(after?: () => void) {
  const { dict } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [target, setTarget] = useState<{ id: string; code: string; name: string } | null>(null);
  const [pending, start] = useTransition();

  const dialog = (
    <ConfirmDialog
      open={!!target}
      onClose={() => setTarget(null)}
      loading={pending}
      title={dict.products.deleteTitle}
      body={
        <p>
          <strong className="text-ink">{target?.name}</strong> (<span dir="ltr">{target?.code}</span>) — {dict.common.deleteBody}
        </p>
      }
      confirmLabel={dict.common.delete}
      cancelLabel={dict.common.cancel}
      onConfirm={() =>
        start(async () => {
          const res = await deleteProduct(target!.id);
          setTarget(null);
          if (res.ok) {
            toast({ tone: "success", title: dict.products.deleted });
            after ? after() : router.refresh();
          } else {
            toast({ tone: "error", title: res.message });
          }
        })
      }
    />
  );
  return { askDelete: setTarget, dialog };
}
