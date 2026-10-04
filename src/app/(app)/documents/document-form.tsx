"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, NotebookPen, Plus, Save, Send, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { useToast } from "@/components/ui/toast";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useGridNav } from "@/hooks/use-grid-nav";
import { Button } from "@/components/ui/button";
import { Field, FormGrid } from "@/components/ui/field";
import { FormActions, FormSection } from "@/components/ui/form-section";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn, formatDate, formatMoney, formatNumber } from "@/lib/utils";
import { DOC_STOCK_EFFECT, DOC_TYPES, documentTotals, isIncoming, lineTotals, needsSupplier, needsToWarehouse, type DocType } from "@/lib/documents";
import { ScanBar, type ScanProduct } from "@/components/forms/scan-bar";
import { saveDocument } from "./actions";
import type { DocInput, DocLineInput } from "./types";

export type DocProduct = { id: string; name: string; code: string; barcode: string | null; unit: string; cost: number; taxRate: number };
export type DocLevel = {
  warehouseId: string;
  productId: string;
  batchId: string | null;
  batchNumber: string | null;
  expiryDate: string | null;
  quantity: number;
};

let seq = 0;
const uid = () => `d${Date.now().toString(36)}${(++seq).toString(36)}`;
export const newDocLine = (): DocLineInput => ({
  key: uid(),
  productId: "",
  batchId: "",
  batchNumber: "",
  expiryDate: "",
  quantity: "",
  unitPrice: "",
  discount: "",
  taxRate: "",
});

export function DocumentForm({
  mode,
  id,
  number,
  status,
  initial,
  warehouses,
  suppliers,
  products,
  levels,
  today,
  currencies,
  baseCurrency,
}: {
  mode: "create" | "edit";
  id?: string;
  number?: string;
  status?: string;
  initial: DocInput;
  warehouses: ComboOption[];
  suppliers: ComboOption[];
  products: DocProduct[];
  levels: DocLevel[];
  today: string;
  currencies: { code: string; name: string; rate: number }[];
  baseCurrency: string;
}) {
  const { dict, t } = useI18n();
  const d = dict.documents;
  const v = dict.validation;
  const toast = useToast();
  const router = useRouter();

  const [doc, setDoc] = useState<DocInput>(() => ({
    ...initial,
    lines: initial.lines.length ? initial.lines : [{ ...newDocLine(), key: "row-0" }],
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  const [busy, start] = useTransition();
  const [busyAction, setBusyAction] = useState<"draft" | "submit" | null>(null);
  const baseline = useRef(JSON.stringify(initial));
  const pendingFocus = useRef<string | null>(null);

  const dirty = JSON.stringify({ ...doc, lines: doc.lines.filter((l) => l.productId) }) !== baseline.current;
  const { guard, dialog } = useUnsavedChanges(dirty && !busy);

  const incoming = isIncoming(doc.type);
  const pmap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const productOptions = useMemo(() => products.map((p) => ({ value: p.id, label: p.name, meta: p.code })), [products]);

  const set = <K extends keyof DocInput>(k: K, val: DocInput[K]) => {
    setDoc((x) => ({ ...x, [k]: val }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  const batchesFor = useCallback(
    (productId: string) =>
      levels
        .filter((l) => l.warehouseId === doc.warehouseId && l.productId === productId && l.quantity > 0)
        .sort((a, b) => (a.expiryDate ?? "9999").localeCompare(b.expiryDate ?? "9999")),
    [levels, doc.warehouseId],
  );
  const levelOf = (l: DocLineInput) =>
    levels.find((x) => x.warehouseId === doc.warehouseId && x.productId === l.productId && (x.batchId ?? "") === l.batchId);

  // ── rows
  const addRow = useCallback(() => {
    const row = newDocLine();
    pendingFocus.current = row.key;
    setDoc((x) => ({ ...x, lines: [...x.lines, row] }));
  }, []);
  const grid = useGridNav(addRow);

  const update = (key: string, patch: Partial<DocLineInput>) => {
    setDoc((x) => ({ ...x, lines: x.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));
    setErrors((e) => {
      const n = { ...e };
      for (const f of Object.keys(patch)) delete n[`${key}.${f}`];
      delete n.lines;
      return n;
    });
  };
  const remove = (key: string) =>
    setDoc((x) => ({ ...x, lines: x.lines.length === 1 ? [newDocLine()] : x.lines.filter((l) => l.key !== key) }));

  const pickProduct = (key: string, productId: string | null) => {
    const p = productId ? pmap.get(productId) : undefined;
    const patch: Partial<DocLineInput> = { productId: productId ?? "", batchId: "", batchNumber: "", expiryDate: "" };
    if (p) {
      patch.unitPrice = (p.cost / (Number(doc.exchangeRate) || 1)).toFixed(2);
      patch.taxRate = String(p.taxRate);
      if (!incoming) patch.batchId = batchesFor(p.id)[0]?.batchId ?? "";
    }
    update(key, patch);
  };

  // ── barcode scanner: +1 on an existing row, otherwise fill an empty row or add one
  const onScanned = (p: ScanProduct): "added" | "increased" => {
    const existing = [...doc.lines].reverse().find((l) => l.productId === p.id);
    if (existing) {
      update(existing.key, { quantity: String(+((Number(existing.quantity) || 0) + 1).toFixed(3)) });
      return "increased";
    }
    let key = doc.lines.find((l) => !l.productId)?.key;
    if (!key) {
      const row = newDocLine();
      key = row.key;
      setDoc((x) => ({ ...x, lines: [...x.lines, row] }));
    }
    pickProduct(key, p.id);
    update(key, { quantity: "1" });
    return "added";
  };

  const isBase = doc.currency === baseCurrency;
  const rate = Number(doc.exchangeRate) || 1;
  const changeCurrency = (code: string) => {
    const next = currencies.find((c) => c.code === code);
    if (!next) return;
    const oldRate = rate;
    const newRate = code === baseCurrency ? 1 : next.rate;
    setDoc((x) => ({
      ...x,
      currency: code,
      exchangeRate: String(newRate),
      lines: x.lines.map((l) => ({
        ...l,
        unitPrice: l.unitPrice ? ((Number(l.unitPrice) * oldRate) / newRate).toFixed(2) : l.unitPrice,
        discount: l.discount ? ((Number(l.discount) * oldRate) / newRate).toFixed(2) : l.discount,
      })),
    }));
  };
  const money = (v: number) => formatMoney(v, doc.currency);

  const rowRef = (key: string) => (el: HTMLElement | null) => {
    if (el && el.offsetParent !== null && pendingFocus.current === key) {
      pendingFocus.current = null;
      requestAnimationFrame(() => el.querySelector<HTMLElement>("[data-grid-cell]")?.focus());
    }
  };

  // ── totals (same function the server uses)
  const amounts = (l: DocLineInput) => ({
    quantity: Number(l.quantity) || 0,
    unitPrice: Number(l.unitPrice) || 0,
    discount: Number(l.discount) || 0,
    taxRate: Number(l.taxRate) || 0,
  });
  const filled = doc.lines.filter((l) => l.productId);
  const totals = documentTotals(filled.map(amounts));

  // ── validation mirrors the server so most errors show before a round-trip
  const validate = (strict: boolean) => {
    const e: Record<string, string> = {};
    if (!doc.date) e.date = v.invalidDate;
    if (!(Number(doc.exchangeRate) > 0)) e.exchangeRate = v.invalidNumber;
    if (!doc.warehouseId) e.warehouseId = t(v.required, { field: d.warehouse });
    if (needsToWarehouse(doc.type)) {
      if (!doc.toWarehouseId) e.toWarehouseId = t(v.required, { field: d.toWarehouse });
      else if (doc.toWarehouseId === doc.warehouseId) e.toWarehouseId = v.sameWarehouse;
    }
    if (strict && needsSupplier(doc.type) && !doc.supplierId) e.supplierId = v.supplierRequired;
    if (strict && !filled.length) e.lines = v.noItems;
    for (const l of doc.lines) {
      if (!l.productId && !l.quantity && !l.unitPrice) continue;
      const k = (f: string) => `${l.key}.${f}`;
      const a = amounts(l);
      if (!l.productId) e[k("productId")] = t(v.required, { field: d.product });
      if (!(a.quantity > 0)) e[k("quantity")] = v.qtyPositive;
      else if (strict && !incoming && DOC_STOCK_EFFECT[doc.type] !== "NONE") {
        const avail = levelOf(l)?.quantity ?? 0;
        if (a.quantity > avail) e[k("quantity")] = t(v.qtyExceeds, { n: formatNumber(avail) });
      }
      if (l.unitPrice === "" || a.unitPrice < 0) e[k("unitPrice")] = v.invalidPrice;
      if (a.discount > a.quantity * a.unitPrice + 0.001) e[k("discount")] = v.discountTooHigh;
    }
    setErrors(e);
    if (Object.keys(e).length) {
      toast({ tone: "error", title: e.lines ?? v.fixErrors });
      const first = Object.keys(e)[0]!;
      requestAnimationFrame(() =>
        (document.querySelector<HTMLElement>(`[data-err="${first}"]`) ?? document.getElementById(`f-${first}`))?.focus(),
      );
      return false;
    }
    return true;
  };

  const save = (submit: boolean) => {
    if (busy) return;
    setBusyAction(submit ? "submit" : "draft");
    start(async () => {
      const res = await saveDocument(id ?? null, { ...doc, lines: filled }, submit);
      setConfirm(false);
      setBusyAction(null);
      if (res.ok) {
        baseline.current = JSON.stringify({ ...doc, lines: filled });
        toast(submit ? { tone: "info", title: d.submitted, body: res.number } : { tone: "success", title: `✓ ${d.savedDraft}`, body: res.number });
        router.push(`/documents/${res.id}`);
        router.refresh();
      } else {
        setErrors(res.errors ?? {});
        toast({ tone: "error", title: res.message });
      }
    });
  };

  // ── cells
  const err = (l: DocLineInput, f: string) => errors[`${l.key}.${f}`];
  const unit = (l: DocLineInput) => pmap.get(l.productId)?.unit ?? "";
  const numInput = (l: DocLineInput, f: "quantity" | "unitPrice" | "discount", extra: Partial<React.ComponentProps<typeof Input>> = {}) => (
    <Input
      data-grid-cell=""
      data-err={`${l.key}.${f}`}
      type="number"
      inputMode="decimal"
      min={0}
      step={f === "quantity" ? "any" : "0.01"}
      value={l[f]}
      onChange={(e) => update(l.key, { [f]: e.target.value })}
      invalid={!!err(l, f)}
      dir="ltr"
      className="h-10 text-end"
      disabled={!l.productId}
      {...extra}
    />
  );

  const cells: Record<string, (l: DocLineInput) => React.ReactNode> = {
    product: (l) => (
      <div data-err={`${l.key}.productId`} tabIndex={-1}>
        <Combobox
          options={productOptions}
          value={l.productId || null}
          onChange={(pid) => pickProduct(l.key, pid)}
          onPicked={(btn) => grid.next(btn)}
          placeholder={dict.stock.productPh}
          emptyText={dict.common.noResults}
          invalid={!!err(l, "productId")}
          clearable={false}
          triggerProps={{ "data-grid-cell": "" }}
          className="h-10"
        />
      </div>
    ),
    batch: (l) =>
      incoming ? (
        <Input
          data-grid-cell=""
          value={l.batchNumber}
          onChange={(e) => update(l.key, { batchNumber: e.target.value })}
          placeholder={dict.stock.batchNew}
          dir="ltr"
          className="h-10 font-mono text-[13px]"
          disabled={!l.productId}
          aria-label={d.batch}
        />
      ) : (
        <Select
          data-grid-cell=""
          value={l.batchId}
          onChange={(e) => update(l.key, { batchId: e.target.value })}
          className="h-10 text-[13px]"
          disabled={!l.productId}
          aria-label={d.batch}
        >
          {batchesFor(l.productId).length === 0 && <option value="">{dict.stock.noBatch}</option>}
          {batchesFor(l.productId).map((b) => (
            <option key={b.batchId ?? "none"} value={b.batchId ?? ""}>
              {(b.batchNumber ?? dict.stock.noBatch) + (b.expiryDate ? ` · ${formatDate(b.expiryDate)}` : "") + ` · ${formatNumber(b.quantity)}`}
            </option>
          ))}
        </Select>
      ),
    expiry: (l) => (
      <Input
        data-grid-cell=""
        data-err={`${l.key}.expiryDate`}
        type="date"
        value={l.expiryDate}
        onChange={(e) => update(l.key, { expiryDate: e.target.value })}
        className="h-10 text-[13px]"
        disabled={!l.productId}
        aria-label={d.expiry}
      />
    ),
    qty: (l) => numInput(l, "quantity", { suffix: unit(l), placeholder: "0", "aria-label": d.qty }),
    price: (l) => numInput(l, "unitPrice", { prefix: doc.currency === "USD" ? "$" : undefined, suffix: doc.currency === "USD" ? undefined : doc.currency, placeholder: "0.00", "aria-label": d.unitPrice }),
    discount: (l) => numInput(l, "discount", { prefix: doc.currency === "USD" ? "$" : undefined, suffix: doc.currency === "USD" ? undefined : doc.currency, placeholder: "0.00", "aria-label": d.discount }),
    total: (l) => (
      <div className="pt-2.5 text-end font-semibold tabular" dir="ltr">
        {l.productId ? money(lineTotals(amounts(l)).net) : "—"}
      </div>
    ),
  };
  const cols = incoming ? ["product", "batch", "expiry", "qty", "price", "discount", "total"] : ["product", "batch", "qty", "price", "discount", "total"];
  const headers: Record<string, string> = {
    product: d.product,
    batch: d.batch,
    expiry: d.expiry,
    qty: d.qty,
    price: d.unitPrice,
    discount: d.discount,
    total: d.total,
  };
  const widths: Record<string, string> = {
    product: "min-w-[200px]",
    batch: incoming ? "w-[140px]" : "w-[220px]",
    expiry: "w-[140px]",
    qty: "w-[115px]",
    price: "w-[120px]",
    discount: "w-[110px]",
    total: "w-[110px] text-end",
  };
  const errField: Record<string, string> = { product: "productId", qty: "quantity", price: "unitPrice", discount: "discount", expiry: "expiryDate", batch: "batchNumber" };
  const rowErrors = (l: DocLineInput) =>
    Object.entries(errors)
      .filter(([k, m]) => k.startsWith(`${l.key}.`) && m)
      .map(([, m]) => m);

  const effect = DOC_STOCK_EFFECT[doc.type];

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="zw-card">
      {/* ── Document Information */}
      <FormSection title={d.sectionInfo} description={d.sectionInfoDesc} icon={<FileText className="h-4 w-4" />} collapsible={false}>
        <FormGrid cols={3}>
          <Field label={d.number} htmlFor="f-number" hint={d.numberHint}>
            <Input id="f-number" value={number ?? "DOC-…"} readOnly disabled className="font-mono" dir="ltr" />
          </Field>
          <Field label={d.type} htmlFor="f-type" required>
            <Select
              id="f-type"
              value={doc.type}
              disabled={mode === "edit"}
              onChange={(e) => {
                const next = e.target.value as DocType;
                // batches mean different things for incoming vs outgoing — reset them
                setDoc((x) => ({
                  ...x,
                  type: next,
                  toWarehouseId: needsToWarehouse(next) ? x.toWarehouseId : "",
                  lines: isIncoming(next) === isIncoming(x.type) ? x.lines : x.lines.map((l) => ({ ...l, batchId: "", batchNumber: "", expiryDate: "" })),
                }));
              }}
            >
              {DOC_TYPES.map((tp) => (
                <option key={tp} value={tp}>
                  {dict.docType[tp]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={d.date} htmlFor="f-date" required error={errors.date}>
            <Input id="f-date" type="date" value={doc.date} max={today} onChange={(e) => set("date", e.target.value)} invalid={!!errors.date} />
          </Field>
          <Field label={d.warehouse} htmlFor="f-warehouseId" required error={errors.warehouseId}>
            <Combobox
              id="f-warehouseId"
              options={warehouses}
              value={doc.warehouseId || null}
              onChange={(w) => {
                setDoc((x) => ({ ...x, warehouseId: w ?? "", lines: incoming ? x.lines : x.lines.map((l) => ({ ...l, batchId: "" })) }));
                setErrors((e) => ({ ...e, warehouseId: "" }));
              }}
              placeholder={dict.stock.chooseWarehouse}
              emptyText={dict.common.noResults}
              invalid={!!errors.warehouseId}
              clearable={false}
            />
          </Field>
          {needsToWarehouse(doc.type) ? (
            <Field label={d.toWarehouse} htmlFor="f-toWarehouseId" required error={errors.toWarehouseId}>
              <Combobox
                id="f-toWarehouseId"
                options={warehouses.filter((w) => w.value !== doc.warehouseId)}
                value={doc.toWarehouseId || null}
                onChange={(w) => set("toWarehouseId", w ?? "")}
                placeholder={dict.stock.chooseWarehouse}
                emptyText={dict.common.noResults}
                invalid={!!errors.toWarehouseId}
                clearable={false}
              />
            </Field>
          ) : (
            <Field
              label={d.supplier}
              htmlFor="f-supplierId"
              required={needsSupplier(doc.type)}
              optionalLabel={dict.common.optional}
              error={errors.supplierId}
            >
              <Combobox
                id="f-supplierId"
                options={suppliers}
                value={doc.supplierId || null}
                onChange={(sid) => set("supplierId", sid ?? "")}
                placeholder={d.supplierPh}
                emptyText={dict.common.noResults}
                invalid={!!errors.supplierId}
              />
            </Field>
          )}
          <Field label={d.referenceNumber} htmlFor="f-referenceNumber" optionalLabel={dict.common.optional} error={errors.referenceNumber}>
            <Input
              id="f-referenceNumber"
              value={doc.referenceNumber}
              onChange={(e) => set("referenceNumber", e.target.value)}
              placeholder={d.referenceNumberPh}
              maxLength={60}
            />
          </Field>
          <Field label={dict.currency.documentCurrency} htmlFor="f-currency" required>
            <Select id="f-currency" value={doc.currency} onChange={(e) => changeCurrency(e.target.value)}>
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={dict.currency.exchangeRate}
            htmlFor="f-exchangeRate"
            required
            error={errors.exchangeRate}
            hint={t(dict.currency.rateLine, { code: doc.currency, rate: doc.exchangeRate || "?", base: baseCurrency })}
          >
            <Input
              id="f-exchangeRate"
              type="number"
              inputMode="decimal"
              step="any"
              min={0}
              value={isBase ? "1" : doc.exchangeRate}
              disabled={isBase}
              onChange={(e) => set("exchangeRate", e.target.value)}
              invalid={!!errors.exchangeRate}
              suffix={baseCurrency}
              dir="ltr"
            />
          </Field>
        </FormGrid>
        <p className="mt-3 text-[12.5px] text-ink-muted">
          {dict.docType[doc.type]} — {d.typeDesc[doc.type]}. {effect === "NONE" ? d.noStockEffect : d.stockNote}
        </p>
      </FormSection>

      {/* ── Items */}
      <section className="border-b border-line">
        <div className="flex flex-wrap items-end gap-3 px-5 pb-3 pt-6 sm:px-7">
          <div className="flex-1">
            <h2 className="text-[15px] font-semibold text-ink">{d.sectionItems}</h2>
            <p className="mt-1 hidden text-[13px] text-ink-muted md:block">{d.sectionItemsDesc}</p>
          </div>
          {errors.lines && <p className="text-[13px] font-medium text-red-600">{errors.lines}</p>}
        </div>
        <div className="px-4 pb-4 sm:px-7">
          <ScanBar products={products} onProduct={onScanned} />
        </div>

        <div {...grid.containerProps}>
          <div className="hidden px-5 md:block sm:px-7">
            <table className="w-full table-fixed text-[14px]">
              <thead>
                <tr className="border-b border-line text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
                  <th className="w-8 py-2 text-start">#</th>
                  {cols.map((c) => (
                    <th key={c} className={cn("px-1.5 py-2 text-start", widths[c])}>
                      {headers[c]}
                    </th>
                  ))}
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {doc.lines.map((l, i) => (
                  <tr key={l.key} ref={rowRef(l.key)} className={cn("align-top", rowErrors(l).length > 0 && "bg-red-50/40")}>
                    <td className="py-2 text-[12px] text-ink-faint tabular">
                      <div className="pt-2.5">{i + 1}</div>
                    </td>
                    {cols.map((c) => (
                      <td key={c} className="px-1.5 py-2">
                        {cells[c]!(l)}
                      </td>
                    ))}
                    <td className="py-2 text-end">
                      <button
                        type="button"
                        onClick={() => remove(l.key)}
                        aria-label={d.removeItem}
                        className="mt-1 rounded-lg p-2 text-ink-faint hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {doc.lines.some((l) => rowErrors(l).length) && (
              <ul className="mt-1 space-y-0.5 text-[12.5px] font-medium text-red-600">
                {doc.lines.map((l, i) => (rowErrors(l).length ? <li key={l.key}>#{i + 1}: {rowErrors(l).join(" · ")}</li> : null))}
              </ul>
            )}
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 px-4 md:hidden">
            {doc.lines.map((l, i) => (
              <li key={l.key} ref={rowRef(l.key)} className="rounded-card border border-line p-3.5">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-ink-muted">#{i + 1}</span>
                  <button type="button" onClick={() => remove(l.key)} aria-label={d.removeItem} className="rounded-lg p-2 text-ink-faint hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {cols.map((c) =>
                    c === "total" ? (
                      <div key={c} className="col-span-2 flex items-center justify-between border-t border-line pt-2 text-[13px]">
                        <span className="text-ink-muted">{headers[c]}</span>
                        <span className="font-semibold" dir="ltr">
                          {money(lineTotals(amounts(l)).net)}
                        </span>
                      </div>
                    ) : (
                      <div key={c} className={cn(c === "product" || c === "batch" ? "col-span-2" : "")}>
                        <Field label={headers[c]!} error={err(l, errField[c]!)}>
                          {cells[c]!(l)}
                        </Field>
                      </div>
                    ),
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-5 px-5 pb-6 pt-3 sm:flex-row sm:items-start sm:px-7">
          <Button type="button" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={addRow}>
            {d.addItem}
          </Button>
          {/* Summary */}
          <dl className="w-full space-y-2 rounded-card bg-canvas p-4 text-[14px] sm:ms-auto sm:max-w-sm">
            {[
              [d.subtotal, totals.subtotal],
              [d.discount, totals.discountTotal ? -totals.discountTotal : 0],
              [d.tax, totals.taxTotal],
            ].map(([k, val]) => (
              <div key={k as string} className="flex justify-between">
                <dt className="text-ink-muted">{k}</dt>
                <dd className="tabular" dir="ltr">
                  {money(val as number)}
                </dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between border-t border-line-strong pt-2.5">
              <dt className="font-semibold text-ink">{d.grandTotal}</dt>
              <dd className="text-[20px] font-bold tabular text-ink" dir="ltr">
                {money(totals.grandTotal)}
              </dd>
            </div>
            {!isBase && (
              <div className="flex justify-between text-[12.5px] text-ink-muted">
                <dt>{t(dict.currency.inBase, { base: baseCurrency })}</dt>
                <dd className="tabular" dir="ltr">
                  {formatMoney(totals.grandTotal * rate, baseCurrency)}
                </dd>
              </div>
            )}
            <div className="text-end text-[12px] text-ink-muted">
              {filled.length} {d.items.toLowerCase()}
            </div>
          </dl>
        </div>
      </section>

      {/* ── Notes */}
      <FormSection title={d.sectionNotes} description={d.sectionNotesDesc} icon={<NotebookPen className="h-4 w-4" />} defaultOpen={!!doc.notes}>
        <Textarea value={doc.notes} onChange={(e) => set("notes", e.target.value)} rows={3} placeholder={d.notesPh} maxLength={2000} />
      </FormSection>

      <FormActions>
        <Button type="button" variant="secondary" onClick={() => guard(id ? `/documents/${id}` : "/documents")} disabled={busy}>
          {dict.common.cancel}
        </Button>
        <Button
          type="button"
          variant="secondary"
          icon={<Save className="h-4 w-4" />}
          loading={busyAction === "draft"}
          loadingText={dict.common.saving}
          disabled={busy}
          onClick={() => validate(false) && save(false)}
        >
          {d.saveDraft}
        </Button>
        <Button type="button" icon={<Send className="h-4 w-4 rtl:-scale-x-100" />} disabled={busy} onClick={() => validate(true) && setConfirm(true)}>
          {status === "REJECTED" ? d.resubmit : d.submit}
        </Button>
      </FormActions>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => save(true)}
        loading={busyAction === "submit"}
        tone="primary"
        title={d.submitTitle}
        body={
          <div className="space-y-3">
            <p>{t(d.submitBody, { n: number ?? dict.docType[doc.type] })}</p>
            <div className="flex justify-between rounded-lg bg-canvas px-3 py-2 text-[14px]">
              <span>{d.grandTotal}</span>
              <strong dir="ltr">{money(totals.grandTotal)}</strong>
            </div>
          </div>
        }
        confirmLabel={d.submit}
        cancelLabel={dict.common.cancel}
      />
      {dialog}
    </form>
  );
}
