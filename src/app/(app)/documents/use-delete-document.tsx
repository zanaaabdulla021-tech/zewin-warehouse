"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteDocument } from "./actions";

export function useDeleteDocument(after?: () => void) {
  const { dict } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [target, setTarget] = useState<{ id: string; number: string } | null>(null);
  const [pending, start] = useTransition();
  const dialog = (
    <ConfirmDialog
      open={!!target}
      onClose={() => setTarget(null)}
      loading={pending}
      title={dict.documents.deleteTitle}
      body={
        <p>
          <strong className="font-mono text-ink" dir="ltr">{target?.number}</strong> — {dict.common.deleteBody}
        </p>
      }
      confirmLabel={dict.common.delete}
      cancelLabel={dict.common.cancel}
      onConfirm={() =>
        start(async () => {
          const res = await deleteDocument(target!.id);
          setTarget(null);
          toast(res.ok ? { tone: "success", title: dict.documents.deleted } : { tone: "error", title: res.message });
          if (res.ok) (after ? after() : router.refresh());
        })
      }
    />
  );
  return { askDelete: setTarget, dialog };
}
