"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteWarehouse } from "./actions";

/** Delete with typed confirmation (warehouses are critical records). */
export function useDeleteWarehouse(after?: () => void) {
  const { dict, t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [target, setTarget] = useState<{ id: string; code: string; name: string } | null>(null);
  const [pending, start] = useTransition();

  const dialog = (
    <ConfirmDialog
      open={!!target}
      onClose={() => setTarget(null)}
      loading={pending}
      title={dict.warehouses.deleteTitle}
      body={
        <p>
          <strong className="text-ink">{target?.name}</strong> (<span dir="ltr">{target?.code}</span>) — {dict.common.deleteBody}
        </p>
      }
      confirmWord={target?.code}
      confirmWordHint={target ? t(dict.common.typeToConfirm, { word: target.code }) : undefined}
      confirmLabel={dict.common.delete}
      cancelLabel={dict.common.cancel}
      onConfirm={() =>
        start(async () => {
          const res = await deleteWarehouse(target!.id);
          if (res.ok) {
            toast({ tone: "success", title: dict.warehouses.deleted });
            setTarget(null);
            after ? after() : router.refresh();
          } else {
            toast({ tone: "error", title: res.message });
            setTarget(null);
          }
        })
      }
    />
  );

  return { askDelete: setTarget, dialog };
}
