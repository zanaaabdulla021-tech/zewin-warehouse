"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Printer, Send, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { submitDocument } from "../actions";
import { useDeleteDocument } from "../use-delete-document";

export function DocumentDetailActions({
  doc,
  perms,
}: {
  doc: { id: string; number: string; status: string; editable: boolean };
  perms: { edit: boolean; delete: boolean; submit: boolean };
}) {
  const { dict, t } = useI18n();
  const d = dict.documents;
  const router = useRouter();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, start] = useTransition();
  const { askDelete, dialog } = useDeleteDocument(() => router.push("/documents"));

  return (
    <>
      {doc.editable && perms.submit && (
        <Button icon={<Send className="h-4 w-4 rtl:-scale-x-100" />} onClick={() => setConfirm(true)}>
          {doc.status === "REJECTED" ? d.resubmit : d.submit}
        </Button>
      )}
      {doc.editable && perms.edit && (
        <Link href={`/documents/${doc.id}/edit`}>
          <Button variant="secondary" icon={<Pencil className="h-4 w-4" />}>
            {dict.common.edit}
          </Button>
        </Link>
      )}
      <a href={`/print/documents/${doc.id}`} target="_blank" rel="noreferrer">
        <Button variant="secondary" icon={<Printer className="h-4 w-4" />}>
          {d.print}
        </Button>
      </a>
      {doc.editable && perms.delete && (
        <DropdownMenu
          trigger={
            <Button variant="secondary" size="icon" aria-label={dict.common.actions}>
              <span className="text-lg leading-none">⋯</span>
            </Button>
          }
          items={[{ label: dict.common.delete, icon: <Trash2 />, danger: true, onSelect: () => askDelete(doc) }]}
        />
      )}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        loading={busy}
        tone="primary"
        title={d.submitTitle}
        body={t(d.submitBody, { n: doc.number })}
        confirmLabel={d.submit}
        cancelLabel={dict.common.cancel}
        onConfirm={() =>
          start(async () => {
            const res = await submitDocument(doc.id);
            setConfirm(false);
            toast(res.ok ? { tone: "info", title: d.submitted } : { tone: "error", title: res.message });
            router.refresh();
          })
        }
      />
      {dialog}
    </>
  );
}
