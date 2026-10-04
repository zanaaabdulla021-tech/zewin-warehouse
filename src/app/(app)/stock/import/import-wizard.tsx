"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Sparkles, Upload } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SwitchField } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn, formatDate, formatMoney, formatNumber } from "@/lib/utils";
import { commitImport, previewImport, type PreviewRow } from "./actions";

export function ImportWizard() {
  const { dict, t } = useI18n();
  const im = dict.importer;
  const toast = useToast();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [createMissing, setCreateMissing] = useState(false);
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [reading, startRead] = useTransition();
  const [importing, startImport] = useTransition();

  const form = (f: File, cm: boolean) => {
    const fd = new FormData();
    fd.set("file", f);
    fd.set("createMissing", cm ? "1" : "0");
    return fd;
  };

  const preview = (f: File, cm: boolean) =>
    startRead(async () => {
      const res = await previewImport(form(f, cm));
      if (res.ok) setRows(res.rows);
      else {
        setRows(null);
        toast({ tone: "error", title: res.message });
      }
    });

  const ok = useMemo(() => rows?.filter((r) => !r.errors.length) ?? [], [rows]);
  const bad = (rows?.length ?? 0) - ok.length;
  const shown = (errorsOnly ? rows?.filter((r) => r.errors.length) : rows) ?? [];
  const whCount = new Set(ok.map((r) => r.warehouseCode)).size;

  const run = () =>
    startImport(async () => {
      const res = await commitImport(form(file!, createMissing));
      setConfirm(false);
      if (res.ok) {
        toast({ tone: "success", title: `✓ ${t(im.done, { n: res.imported, refs: res.references.join(", ") })}` });
        router.push(`/stock/movements?ref=${res.references[0] ?? ""}`);
        router.refresh();
      } else toast({ tone: "error", title: res.message });
    });

  const stepCls = "zw-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6";
  const num = (n: number, done: boolean) => (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[14px] font-bold",
        done ? "bg-emerald-500 text-white" : "bg-brand-50 text-brand-700",
      )}
    >
      {done ? <CheckCircle2 className="h-5 w-5" /> : n}
    </span>
  );

  return (
    <div className="space-y-4">
      {/* Step 1 */}
      <div className={stepCls}>
        {num(1, false)}
        <div className="flex-1">
          <h2 className="text-[15px] font-semibold">{im.step1}</h2>
          <p className="mt-0.5 text-[13.5px] text-ink-muted">{im.step1Desc}</p>
        </div>
        <a href="/api/import/template" download>
          <Button variant="secondary" icon={<Download className="h-4 w-4" />}>
            {im.downloadTemplate}
          </Button>
        </a>
      </div>

      {/* Step 2 */}
      <div className={stepCls}>
        {num(2, !!rows)}
        <div className="flex-1">
          <h2 className="text-[15px] font-semibold">{im.step2}</h2>
          <p className="mt-0.5 text-[13.5px] text-ink-muted">{im.step2Desc}</p>
          {file && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-canvas px-2.5 py-1 text-[13px] text-ink-soft">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              {file.name}
            </p>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          data-testid="import-file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setFile(f);
            preview(f, createMissing);
            e.target.value = "";
          }}
        />
        <Button icon={<Upload className="h-4 w-4" />} loading={reading} loadingText={im.reading} onClick={() => input.current?.click()}>
          {im.chooseFile}
        </Button>
      </div>

      {/* Step 3 — preview */}
      {rows && (
        <div className="zw-card overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-line p-5 sm:p-6 lg:flex-row lg:items-center">
            {num(3, false)}
            <div className="flex-1">
              <h2 className="text-[15px] font-semibold">{im.preview}</h2>
              <p className="mt-0.5 text-[13.5px] text-ink-muted">
                {t(im.rowsSummary, { total: rows.length, ok: ok.length, bad })}
              </p>
            </div>
            <div className="lg:w-80">
              <SwitchField
                id="create-missing"
                checked={createMissing}
                onChange={(v) => {
                  setCreateMissing(v);
                  if (file) preview(file, v);
                }}
                label={im.createMissing}
                description={im.createMissingDesc}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-[13.5px] text-ink-soft">
              <input type="checkbox" checked={errorsOnly} onChange={(e) => setErrorsOnly(e.target.checked)} className="h-4 w-4 accent-brand-600" />
              {im.errorsOnly} {bad > 0 && <Badge tone="red" dot={false}>{bad}</Badge>}
            </label>
          </div>

          <div className="zw-scroll max-h-[55vh] overflow-auto">
            <table className="w-full min-w-[860px] text-[13.5px]">
              <thead className="sticky top-0 z-10 bg-canvas">
                <tr className="border-b border-line text-[11.5px] font-semibold uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-2.5 text-start">{im.row}</th>
                  <th className="px-3 py-2.5 text-start">{dict.stock.warehouse}</th>
                  <th className="px-3 py-2.5 text-start">{dict.stock.product}</th>
                  <th className="px-3 py-2.5 text-start">{dict.stock.batch}</th>
                  <th className="px-3 py-2.5 text-start">{dict.stock.expiry}</th>
                  <th className="px-3 py-2.5 text-end">{dict.stock.quantity}</th>
                  <th className="px-3 py-2.5 text-end">{dict.stock.unitCost}</th>
                  <th className="px-4 py-2.5 text-start">{im.status}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.row} className={cn("border-b border-line align-top last:border-0", r.errors.length && "bg-red-50/50")}>
                    <td className="px-4 py-2.5 text-ink-faint tabular">{r.row}</td>
                    <td className="px-3 py-2.5 font-mono text-[12.5px]" dir="ltr">{r.warehouseCode || "—"}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[12.5px]" dir="ltr">{r.productCode || "—"}</span>
                        {r.isNewProduct && (
                          <Badge tone="blue" dot={false}>
                            <Sparkles className="h-3 w-3" />
                            {im.newProduct}
                          </Badge>
                        )}
                      </div>
                      {r.productName && <div className="text-[12px] text-ink-muted">{r.productName}</div>}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[12.5px]" dir="ltr">{r.batch || "—"}</td>
                    <td className="px-3 py-2.5">{r.expiry ? formatDate(r.expiry) : "—"}</td>
                    <td className="px-3 py-2.5 text-end tabular" dir="ltr">{r.quantity === null ? "—" : formatNumber(r.quantity)}</td>
                    <td className="px-3 py-2.5 text-end tabular" dir="ltr">{r.unitCost === null ? "—" : formatMoney(r.unitCost)}</td>
                    <td className="px-4 py-2.5">
                      {r.errors.length ? (
                        <ul className="space-y-0.5 text-[12.5px] font-medium text-red-700">
                          {r.errors.map((e) => (
                            <li key={e} className="flex items-start gap-1">
                              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              {e}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <Badge tone="green">{im.ok}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end [&_button]:h-12 sm:[&_button]:h-10">
            <Button disabled={!ok.length || reading} icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => setConfirm(true)}>
              {t(im.run, { n: ok.length })}
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={run}
        loading={importing}
        tone="primary"
        title={t(im.confirmTitle, { n: ok.length })}
        body={t(im.confirmBody, { wh: whCount })}
        confirmLabel={t(im.run, { n: ok.length })}
        cancelLabel={dict.common.cancel}
      />
    </div>
  );
}
