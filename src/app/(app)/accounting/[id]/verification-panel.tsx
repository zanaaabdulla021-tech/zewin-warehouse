"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, ShieldCheck, X } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn, formatMoney } from "@/lib/utils";
import { rejectDocument, verifyDocument } from "../actions";
import { CHECKS, emptyChecklist, type Checklist } from "../checklist";

/**
 * Right-hand column of the verification screen:
 * Financial Summary · Verification Checklist · Accounting Notes · Verify / Reject.
 */
export function VerificationPanel({
  doc,
  totals,
  canVerify,
  hasStockEffect,
  creatorName,
  currency,
  base,
}: {
  doc: { id: string; number: string; status: string };
  totals: { subtotal: number; discount: number; tax: number; total: number };
  canVerify: boolean;
  hasStockEffect: boolean;
  creatorName: string;
  currency: string;
  base: { code: string; rate: number; total: number };
}) {
  const { dict, t } = useI18n();
  const a = dict.accounting;
  const toast = useToast();
  const router = useRouter();
  const [checks, setChecks] = useState<Checklist>(emptyChecklist);
  const [notes, setNotes] = useState("");
  const [dialog, setDialog] = useState<"verify" | "reject" | null>(null);
  const [busy, start] = useTransition();

  const done = CHECKS.filter((k) => checks[k]).length;
  const allChecked = done === CHECKS.length;
  const pending = doc.status === "PENDING";
  const actionable = pending && canVerify;

  const goNext = (nextId: string | null) => {
    router.push(nextId ? `/accounting/${nextId}` : "/accounting");
    router.refresh();
  };

  const verify = () =>
    start(async () => {
      const res = await verifyDocument(doc.id, checks, notes);
      setDialog(null);
      if (res.ok) {
        toast({
          tone: "success",
          title: res.stockReference ? t(a.verified, { n: doc.number, ref: res.stockReference }) : t(a.verifiedNoStock, { n: doc.number }),
        });
        goNext(res.nextId);
      } else {
        toast({ tone: "error", title: res.message });
        router.refresh();
      }
    });

  const reject = (reason?: string) =>
    start(async () => {
      const res = await rejectDocument(doc.id, reason ?? "", checks, notes);
      setDialog(null);
      if (res.ok) {
        toast({ tone: "warning", title: t(a.rejected, { n: doc.number }) });
        goNext(res.nextId);
      } else {
        toast({ tone: "error", title: res.message });
      }
    });

  return (
    <div className="space-y-4 lg:sticky lg:top-20">
      {/* Financial Summary */}
      <section className="zw-card p-5">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">{a.financialSummary}</h2>
        <dl className="mt-3 space-y-2 text-[14px]">
          {[
            [dict.documents.subtotal, totals.subtotal],
            [dict.documents.discount, totals.discount ? -totals.discount : 0],
            [dict.documents.tax, totals.tax],
          ].map(([k, v]) => (
            <div key={k as string} className="flex justify-between">
              <dt className="text-ink-muted">{k}</dt>
              <dd className="tabular" dir="ltr">
                {formatMoney(v as number, currency)}
              </dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between border-t border-line-strong pt-3">
            <dt className="font-semibold text-ink">{dict.documents.grandTotal}</dt>
            <dd className="text-[24px] font-bold tracking-tight tabular text-ink" dir="ltr">
              {formatMoney(totals.total, currency)}
            </dd>
          </div>
          {currency !== base.code && (
            <div className="flex justify-between border-t border-line pt-2 text-[12.5px] text-ink-muted">
              <dt dir="ltr">{t(dict.currency.rateLine, { code: currency, rate: base.rate, base: base.code })}</dt>
              <dd className="font-medium tabular text-ink-soft" dir="ltr">
                {formatMoney(base.total, base.code)}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {actionable ? (
        <>
          {/* Checklist */}
          <section className="zw-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">{a.checklist}</h2>
              <span className={cn("text-[12.5px] font-semibold tabular", allChecked ? "text-emerald-600" : "text-ink-muted")}>
                {done}/{CHECKS.length}
              </span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(done / CHECKS.length) * 100}%` }} />
            </div>
            <ul className="mt-3 space-y-1">
              {CHECKS.map((k) => (
                <li key={k}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-[14px] transition-colors",
                      checks[k] ? "bg-emerald-50/70 text-ink" : "text-ink-soft hover:bg-canvas",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checks[k]}
                      onChange={(e) => setChecks((c) => ({ ...c, [k]: e.target.checked }))}
                      className="peer sr-only"
                    />
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors peer-focus-visible:shadow-focus",
                        checks[k] ? "border-emerald-500 bg-emerald-500 text-white" : "border-line-strong bg-white",
                      )}
                      aria-hidden
                    >
                      {checks[k] && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </span>
                    {a.checks[k]}
                  </label>
                </li>
              ))}
            </ul>
            {!allChecked && (
              <button
                type="button"
                onClick={() => setChecks(Object.fromEntries(CHECKS.map((k) => [k, true])) as Checklist)}
                className="mt-2 text-[12.5px] font-medium text-brand-700 hover:underline"
              >
                {a.checkAll}
              </button>
            )}
          </section>

          {/* Notes */}
          <section className="zw-card p-5">
            <label htmlFor="acc-notes" className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
              {a.notes}
            </label>
            <Textarea
              id="acc-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={a.notesPh}
              className="mt-2"
              maxLength={2000}
            />
          </section>

          {/* Actions */}
          <div className="zw-card sticky bottom-3 z-10 space-y-2 p-3 shadow-pop lg:static lg:shadow-card">
            <Button
              className="h-12 w-full bg-emerald-600 text-[15px] hover:bg-emerald-700 active:bg-emerald-800"
              icon={<Check className="h-5 w-5" />}
              disabled={!allChecked || busy}
              onClick={() => setDialog("verify")}
            >
              {a.verify}
            </Button>
            {!allChecked && <p className="text-center text-[12px] text-ink-muted">{a.checklistHint}</p>}
            <Button
              variant="secondary"
              className="h-11 w-full border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50"
              icon={<X className="h-4 w-4" />}
              disabled={busy}
              onClick={() => setDialog("reject")}
            >
              {a.reject}
            </Button>
          </div>
        </>
      ) : (
        <section className="zw-card flex items-center gap-3 p-5 text-[14px] text-ink-soft">
          {pending ? <ShieldCheck className="h-5 w-5 text-ink-faint" /> : <CheckCircle2 className="h-5 w-5 text-ink-faint" />}
          {pending ? dict.common.forbidden : a.notPending}
        </section>
      )}

      <ConfirmDialog
        open={dialog === "verify"}
        onClose={() => setDialog(null)}
        onConfirm={verify}
        loading={busy}
        tone="primary"
        title={t(a.verifyTitle, { n: doc.number })}
        body={hasStockEffect ? a.verifyBody : a.verifyNoStock}
        confirmLabel={a.verify}
        cancelLabel={dict.common.cancel}
      />
      <ConfirmDialog
        open={dialog === "reject"}
        onClose={() => setDialog(null)}
        onConfirm={reject}
        loading={busy}
        title={t(a.rejectTitle, { n: doc.number })}
        body={t(a.rejectBody, { name: creatorName })}
        reasonLabel={a.rejectReason}
        reasonPlaceholder={a.rejectReasonPh}
        reasonError={a.rejectReasonError}
        confirmLabel={a.reject}
        cancelLabel={dict.common.cancel}
      />
    </div>
  );
}
