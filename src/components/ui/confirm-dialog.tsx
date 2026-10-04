"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "./modal";
import { Button } from "./button";
import { Input, Textarea } from "./input";
import { Field } from "./field";

/**
 * Confirmation for destructive / critical actions.
 * - `confirmWord`: user must type it (critical records)
 * - `reasonLabel`: user must give a reason (e.g. rejecting a document)
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  cancelLabel,
  tone = "danger",
  confirmWord,
  confirmWordHint,
  reasonLabel,
  reasonPlaceholder,
  reasonError,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void | Promise<void>;
  title: string;
  body?: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  tone?: "danger" | "primary";
  confirmWord?: string;
  confirmWordHint?: string;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  reasonError?: string;
  loading?: boolean;
}) {
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setTyped("");
      setReason("");
      setTouched(false);
    }
  }, [open]);

  const wordOk = !confirmWord || typed.trim().toUpperCase() === confirmWord.toUpperCase();
  const reasonOk = !reasonLabel || reason.trim().length >= 3;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      dismissible={!loading}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            loading={loading}
            disabled={!wordOk}
            onClick={() => {
              setTouched(true);
              if (!reasonOk) return;
              onConfirm(reasonLabel ? reason.trim() : undefined);
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        {tone === "danger" && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertTriangle className="h-5 w-5" />
          </span>
        )}
        <div className="flex-1 space-y-4 pt-1 text-[14px] leading-relaxed text-ink-soft">
          {body}
          {confirmWord && (
            <Field label={confirmWordHint ?? confirmWord} htmlFor="zw-confirm-word">
              <Input
                id="zw-confirm-word"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                className="font-mono uppercase"
              />
            </Field>
          )}
          {reasonLabel && (
            <Field
              label={reasonLabel}
              htmlFor="zw-confirm-reason"
              required
              error={touched && !reasonOk ? reasonError : undefined}
            >
              <Textarea
                id="zw-confirm-reason"
                value={reason}
                placeholder={reasonPlaceholder}
                onChange={(e) => setReason(e.target.value)}
                invalid={touched && !reasonOk}
              />
            </Field>
          )}
        </div>
      </div>
    </Modal>
  );
}
