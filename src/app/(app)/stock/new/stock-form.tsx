"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Check,
  ClipboardCheck,
  Plus,
  Trash2,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import { useI18n } from "@/i18n/client";
import { useToast } from "@/components/ui/toast";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useGridNav } from "@/hooks/use-grid-nav";
import { Button } from "@/components/ui/button";
import { Field, FormGrid } from "@/components/ui/field";
import { FormActions, FormSection } from "@/components/ui/form-section";
import { Input, Select } from "@/components/ui/input";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatDate, formatMoney, formatNumber } from "@/lib/utils";
import { ScanBar, type ScanProduct } from "@/components/forms/scan-bar";
import { postStock } from "../actions";
import type { FormLevel, FormProduct, StockLineInput, StockOpInput, StockOpType } from "../types";

const TYPES: { type: StockOpType; icon: React.ElementType }[] = [
  { type: "STOCK_IN", icon: ArrowDownToLine },
  { type: "STOCK_OUT", icon: ArrowUpFromLine },
  { type: "TRANSFER", icon: ArrowLeftRight },
  { type: "ADJUSTMENT", icon: ClipboardCheck },
];
const NEW_BATCH = "__new";

let seq = 0;
const uid = () => `l${Date.now().toString(36)}${(++seq).toString(36)}`;
const newLine = (): StockLineInput => ({
  key: uid(),
  productId: "",
  batchId: "",
  batchNumber: "",
  expiryDate: "",
  quantity: "",
  unitCost: "",
});

export function StockForm({
  initialType,
  initialWarehouseId,
  allowedTypes,
  warehouses,
  products,
  levels,
  today,
}: {
  initialType: StockOpType;
  initialWarehouseId: string;
  allowedTypes: StockOpType[];
  warehouses: ComboOption[];
  products: FormProduct[];
  levels: FormLevel[];
  today: string;
}) {
  const { dict, t } = useI18n();
  const s = dict.stock;
  const v = dict.validation;
  const toast = useToast();
  const router = useRouter();

  const [type, setType] = useState<StockOpType>(initialType);
  const [warehouseId, setWarehouseId] = useState(initialWarehouseId);
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<StockLineInput[]>(() => [{ ...newLine(), key: "row-0" }]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  const [posting, start] = useTransition();
  const pendingFocus = useRef<string | null>(null);

  const dirty = lines.some((l) => l.productId || l.quantity) || !!note;
  const { guard, dialog } = useUnsavedChanges(dirty && !posting);

  const pmap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const productOptions = useMemo<ComboOption[]>(
    () => products.map((p) => ({ value: p.id, label: p.name, meta: p.code })),
    [products],
  );

  /** batches of a product in the source warehouse, earliest expiry first (FEFO) */
  const batchesFor = useCallback(
    (productId: string, includeEmpty = false) =>
      levels
        .filter((l) => l.warehouseId === warehouseId && l.productId === productId && (includeEmpty || l.quantity > 0))
        .sort((a, b) => (a.expiryDate ?? "9999").localeCompare(b.expiryDate ?? "9999")),
    [levels, warehouseId],
  );
  const levelOf = (l: StockLineInput) =>
    levels.find((x) => x.warehouseId === warehouseId && x.productId === l.productId && (x.batchId ?? "") === l.batchId);

  // ── row helpers
  const addRow = useCallback(() => {
    const row = newLine();
    pendingFocus.current = row.key;
    setLines((ls) => [...ls, row]);
  }, []);
  const grid = useGridNav(addRow);

  const update = (key: string, patch: Partial<StockLineInput>) => {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    setErrors((e) => {
      const n = { ...e };
      for (const f of Object.keys(patch)) delete n[`${key}.${f}`];
      delete n.lines;
      return n;
    });
  };
  const remove = (key: string) => setLines((ls) => (ls.length === 1 ? [newLine()] : ls.filter((l) => l.key !== key)));

  const pickProduct = (key: string, productId: string | null) => {
    const p = productId ? pmap.get(productId) : undefined;
    const patch: Partial<StockLineInput> = { productId: productId ?? "", batchId: "", batchNumber: "", expiryDate: "" };
    if (p && type === "STOCK_IN") patch.unitCost = p.cost ? p.cost.toFixed(2) : "";
    if (p && (type === "STOCK_OUT" || type === "TRANSFER")) {
      const fefo = batchesFor(p.id)[0];
      patch.batchId = fefo?.batchId ?? "";
    }
    if (p && type === "ADJUSTMENT") {
      const first = batchesFor(p.id, true)[0];
      patch.batchId = first ? first.batchId ?? "" : p.tracksBatch ? NEW_BATCH : "";
      if (first) patch.quantity = String(first.quantity);
    }
    update(key, patch);
  };

  // ── barcode scanner: +1 on an existing row, otherwise fill an empty row or add one
  const onScanned = (p: ScanProduct): "added" | "increased" => {
    const existing = [...lines].reverse().find((l) => l.productId === p.id);
    if (existing) {
      update(existing.key, { quantity: String(+((Number(existing.quantity) || 0) + 1).toFixed(3)) });
      return "increased";
    }
    let key = lines.find((l) => !l.productId)?.key;
    if (!key) {
      const row = newLine();
      key = row.key;
      setLines((ls) => [...ls, row]);
    }
    pickProduct(key, p.id);
    update(key, { quantity: "1" });
    return "added";
  };

  const switchType = (next: StockOpType) => {
    if (next === type) return;
    setType(next);
    setErrors({});
    // batch choices depend on the type — keep products, reset the rest
    setLines((ls) => ls.map((l) => ({ ...l, batchId: "", batchNumber: "", expiryDate: "", quantity: "", unitCost: "" })));
  };

  // focus the product cell of a freshly added row
  const rowRef = (key: string) => (el: HTMLElement | null) => {
    if (el && el.offsetParent !== null && pendingFocus.current === key) {
      pendingFocus.current = null;
      requestAnimationFrame(() => el.querySelector<HTMLElement>("[data-grid-cell]")?.focus());
    }
  };

  // ── totals
  const filled = lines.filter((l) => l.productId);
  const qtyOf = (l: StockLineInput) => Number(l.quantity) || 0;
  const costOf = (l: StockLineInput) => (l.unitCost ? Number(l.unitCost) : pmap.get(l.productId)?.cost ?? 0);
  const diffOf = (l: StockLineInput) => qtyOf(l) - (levelOf(l)?.quantity ?? 0);
  const totalUnits = filled.reduce((sum, l) => sum + (type === "ADJUSTMENT" ? diffOf(l) : qtyOf(l)), 0);
  const totalValue = filled.reduce((sum, l) => sum + (type === "ADJUSTMENT" ? diffOf(l) : qtyOf(l)) * costOf(l), 0);

  // ── client-side checks (the server re-validates everything)
  const validate = () => {
    const e: Record<string, string> = {};
    if (!warehouseId) e.warehouseId = t(v.required, { field: type === "TRANSFER" ? s.fromWarehouse : s.warehouse });
    if (type === "TRANSFER") {
      if (!toWarehouseId) e.toWarehouseId = t(v.required, { field: s.toWarehouse });
      else if (toWarehouseId === warehouseId) e.toWarehouseId = v.sameWarehouse;
    }
    if (!filled.length) e.lines = v.noItems;
    for (const l of lines) {
      if (!l.productId && !l.quantity) continue;
      const k = (f: string) => `${l.key}.${f}`;
      const p = pmap.get(l.productId);
      if (!p) {
        e[k("productId")] = t(v.required, { field: s.product });
        continue;
      }
      const q = Number(l.quantity);
      if (l.quantity === "" || Number.isNaN(q) || q < 0) e[k("quantity")] = v.invalidQuantity;
      else if (type !== "ADJUSTMENT" && q <= 0) e[k("quantity")] = v.qtyPositive;
      if (type === "STOCK_OUT" || type === "TRANSFER") {
        const avail = levelOf(l)?.quantity ?? 0;
        if (q > avail) e[k("quantity")] = t(v.qtyExceeds, { n: formatNumber(avail) });
      }
      const newBatch = type === "STOCK_IN" || (type === "ADJUSTMENT" && l.batchId === NEW_BATCH);
      if (newBatch && p.tracksBatch && !l.batchNumber.trim()) e[k("batchNumber")] = v.batchRequired;
      if (newBatch && p.tracksExpiry && l.batchNumber.trim() && !l.expiryDate) e[k("expiryDate")] = v.expiryRequired;
    }
    setErrors(e);
    if (Object.keys(e).length) {
      toast({ tone: "error", title: e.lines ?? v.fixErrors });
      const first = Object.keys(e)[0]!;
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-err="${first}"]`)?.focus());
      return false;
    }
    return true;
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (posting) return;
    if (validate()) setConfirm(true);
  };

  const post = () =>
    start(async () => {
      const payload: StockOpInput = {
        type,
        warehouseId,
        toWarehouseId,
        date,
        note,
        lines: filled.map((l) => ({ ...l, batchId: l.batchId === NEW_BATCH ? "" : l.batchId })),
      };
      const res = await postStock(payload);
      setConfirm(false);
      if (res.ok) {
        toast({ tone: "success", title: `✓ ${t(s.posted, { ref: res.reference })}` });
        setLines([newLine()]);
        setNote("");
        router.push(`/stock/movements?ref=${res.reference}`);
        router.refresh();
      } else {
        setErrors(res.errors ?? {});
        toast({ tone: "error", title: res.message });
      }
    });

  // ── cell renderers (shared by desktop table and mobile cards)
  const err = (l: StockLineInput, f: string) => errors[`${l.key}.${f}`];
  const unit = (l: StockLineInput) => pmap.get(l.productId)?.unit ?? "";

  const productCell = (l: StockLineInput) => (
    <div data-err={`${l.key}.productId`} tabIndex={-1}>
      <Combobox
        options={productOptions}
        value={l.productId || null}
        onChange={(id) => pickProduct(l.key, id)}
        onPicked={(btn) => grid.next(btn)}
        placeholder={s.productPh}
        emptyText={dict.common.noResults}
        invalid={!!err(l, "productId")}
        clearable={false}
        triggerProps={{ "data-grid-cell": "" }}
        className="h-10"
      />
    </div>
  );

  const batchCell = (l: StockLineInput) => {
    const p = pmap.get(l.productId);
    if (type === "STOCK_IN" || (type === "ADJUSTMENT" && l.batchId === NEW_BATCH)) {
      return (
        <div className="flex gap-2">
          {type === "ADJUSTMENT" && (
            <Select
              data-grid-cell=""
              value={l.batchId}
              onChange={(e) => update(l.key, { batchId: e.target.value })}
              className="h-10 w-28 shrink-0"
              aria-label={s.batch}
            >
              {batchesFor(l.productId, true).map((b) => (
                <option key={b.batchId ?? "none"} value={b.batchId ?? ""}>
                  {b.batchNumber ?? s.noBatch}
                </option>
              ))}
              <option value={NEW_BATCH}>+ {s.batchNew}</option>
            </Select>
          )}
          <Input
            data-grid-cell=""
            data-err={`${l.key}.batchNumber`}
            value={l.batchNumber}
            onChange={(e) => update(l.key, { batchNumber: e.target.value })}
            placeholder={s.batchNew}
            invalid={!!err(l, "batchNumber")}
            dir="ltr"
            className="h-10 min-w-0 font-mono text-[13px]"
            disabled={!l.productId}
            aria-label={s.batch}
          />
        </div>
      );
    }
    const options = batchesFor(l.productId, type === "ADJUSTMENT");
    return (
      <Select
        data-grid-cell=""
        data-err={`${l.key}.batchId`}
        value={l.batchId}
        onChange={(e) => {
          const lvl = levels.find(
            (x) => x.warehouseId === warehouseId && x.productId === l.productId && (x.batchId ?? "") === e.target.value,
          );
          update(l.key, {
            batchId: e.target.value,
            ...(type === "ADJUSTMENT" && e.target.value !== NEW_BATCH ? { quantity: String(lvl?.quantity ?? 0) } : {}),
          });
        }}
        className="h-10 text-[13px]"
        disabled={!l.productId}
        aria-label={s.batch}
      >
        {options.length === 0 && <option value="">{s.noBatch}</option>}
        {options.map((b) => (
          <option key={b.batchId ?? "none"} value={b.batchId ?? ""}>
            {(b.batchNumber ?? s.noBatch) +
              (b.expiryDate ? ` · ${formatDate(b.expiryDate)}` : "") +
              ` · ${formatNumber(b.quantity)}`}
          </option>
        ))}
        {type === "ADJUSTMENT" && <option value={NEW_BATCH}>+ {s.batchNew}</option>}
      </Select>
    );
  };

  const expiryCell = (l: StockLineInput) => (
    <Input
      data-grid-cell=""
      data-err={`${l.key}.expiryDate`}
      type="date"
      value={l.expiryDate}
      min={today}
      onChange={(e) => update(l.key, { expiryDate: e.target.value })}
      invalid={!!err(l, "expiryDate")}
      className="h-10 text-[13px]"
      disabled={!l.productId}
      aria-label={s.expiry}
    />
  );

  const qtyCell = (l: StockLineInput) => (
    <Input
      data-grid-cell=""
      data-err={`${l.key}.quantity`}
      type="number"
      inputMode="decimal"
      min={0}
      value={l.quantity}
      onChange={(e) => update(l.key, { quantity: e.target.value })}
      invalid={!!err(l, "quantity")}
      suffix={unit(l)}
      placeholder="0"
      dir="ltr"
      className="h-10 text-end"
      disabled={!l.productId}
      aria-label={type === "ADJUSTMENT" ? s.counted : s.quantity}
    />
  );

  const costCell = (l: StockLineInput) => (
    <Input
      data-grid-cell=""
      data-err={`${l.key}.unitCost`}
      type="number"
      inputMode="decimal"
      step="0.01"
      min={0}
      value={l.unitCost}
      onChange={(e) => update(l.key, { unitCost: e.target.value })}
      invalid={!!err(l, "unitCost")}
      prefix="$"
      placeholder="0.00"
      dir="ltr"
      className="h-10 text-end"
      disabled={!l.productId}
      aria-label={s.unitCost}
    />
  );

  const available = (l: StockLineInput) => (l.productId ? levelOf(l)?.quantity ?? 0 : null);
  const diffBadge = (l: StockLineInput) => {
    if (!l.productId || l.quantity === "") return <span className="text-ink-faint">—</span>;
    const d = diffOf(l);
    return (
      <span className={cn("font-semibold tabular", d > 0 ? "text-emerald-600" : d < 0 ? "text-red-600" : "text-ink-muted")} dir="ltr">
        {d > 0 ? "+" : ""}
        {formatNumber(+d.toFixed(3))}
      </span>
    );
  };

  // columns per operation type
  const cols =
    type === "STOCK_IN"
      ? ["product", "batch", "expiry", "qty", "cost", "total"]
      : type === "ADJUSTMENT"
        ? ["product", "batch", "onhand", "qty", "diff"]
        : ["product", "batch", "available", "qty", "total"];
  const headers: Record<string, string> = {
    product: s.product,
    batch: s.batch,
    expiry: s.expiry,
    qty: type === "ADJUSTMENT" ? s.counted : s.quantity,
    cost: s.unitCost,
    total: s.lineTotal,
    available: s.available,
    onhand: s.onHand,
    diff: s.difference,
  };
  const widths: Record<string, string> = {
    product: "min-w-[220px]",
    batch: type === "STOCK_IN" ? "w-[170px]" : "w-[240px]",
    expiry: "w-[150px]",
    qty: "w-[130px]",
    cost: "w-[130px]",
    total: "w-[110px] text-end",
    available: "w-[100px] text-end",
    onhand: "w-[100px] text-end",
    diff: "w-[100px] text-end",
  };
  const cell = (c: string, l: StockLineInput) => {
    switch (c) {
      case "product":
        return productCell(l);
      case "batch":
        return batchCell(l);
      case "expiry":
        return expiryCell(l);
      case "qty":
        return qtyCell(l);
      case "cost":
        return costCell(l);
      case "total":
        return (
          <span className="font-medium tabular" dir="ltr">
            {l.productId ? formatMoney(qtyOf(l) * costOf(l)) : "—"}
          </span>
        );
      case "available":
      case "onhand": {
        const a = available(l);
        return <span className="tabular text-ink-soft" dir="ltr">{a === null ? "—" : formatNumber(a)}</span>;
      }
      case "diff":
        return diffBadge(l);
    }
  };

  const rowErrors = (l: StockLineInput) =>
    Object.entries(errors)
      .filter(([k]) => k.startsWith(`${l.key}.`))
      .map(([, m]) => m);

  return (
    <form onSubmit={submit} noValidate>
      {/* ── Operation type */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4" role="radiogroup" aria-label={s.newOperation}>
        {TYPES.filter((x) => allowedTypes.includes(x.type)).map(({ type: tp, icon: Icon }) => (
          <button
            key={tp}
            type="button"
            role="radio"
            aria-checked={type === tp}
            onClick={() => switchType(tp)}
            className={cn(
              "zw-card flex items-start gap-3 p-3.5 text-start transition-all sm:p-4",
              type === tp ? "border-brand-500 ring-2 ring-brand-500/15" : "hover:border-line-strong",
            )}
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                type === tp ? "bg-brand-600 text-white" : "bg-canvas text-ink-muted",
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold text-ink">{s.types[tp]}</span>
              <span className="mt-0.5 hidden text-[12.5px] leading-snug text-ink-muted sm:block">{s.typesDesc[tp]}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="zw-card">
        {/* ── Header */}
        <FormSection title={s.sectionHeader} description={s.sectionHeaderDesc} icon={<WarehouseIcon className="h-4 w-4" />}>
          <FormGrid cols={type === "TRANSFER" ? 3 : 2}>
            <Field
              label={type === "TRANSFER" ? s.fromWarehouse : s.warehouse}
              htmlFor="f-warehouseId"
              required
              error={errors.warehouseId}
            >
              <Combobox
                id="f-warehouseId"
                options={warehouses}
                value={warehouseId || null}
                onChange={(id) => {
                  setWarehouseId(id ?? "");
                  setErrors((e) => ({ ...e, warehouseId: "" }));
                  // batches belong to the old warehouse — clear them
                  if (type !== "STOCK_IN") setLines((ls) => ls.map((l) => ({ ...l, batchId: "", quantity: "" })));
                }}
                placeholder={s.chooseWarehouse}
                emptyText={dict.common.noResults}
                invalid={!!errors.warehouseId}
                clearable={false}
              />
            </Field>
            {type === "TRANSFER" && (
              <Field label={s.toWarehouse} htmlFor="f-toWarehouseId" required error={errors.toWarehouseId}>
                <Combobox
                  id="f-toWarehouseId"
                  options={warehouses.filter((w) => w.value !== warehouseId)}
                  value={toWarehouseId || null}
                  onChange={(id) => {
                    setToWarehouseId(id ?? "");
                    setErrors((e) => ({ ...e, toWarehouseId: "" }));
                  }}
                  placeholder={s.chooseWarehouse}
                  emptyText={dict.common.noResults}
                  invalid={!!errors.toWarehouseId}
                  clearable={false}
                />
              </Field>
            )}
            <Field label={s.date} htmlFor="f-date" required error={errors.date}>
              <Input id="f-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={s.note} htmlFor="f-note" optionalLabel={dict.common.optional} span={type === "TRANSFER" ? "full" : 2}>
              <Input id="f-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={s.notePh} maxLength={250} />
            </Field>
          </FormGrid>
          <p className="mt-3 text-[12.5px] text-ink-muted">
            {s.reference}: {s.referenceHint}
          </p>
        </FormSection>

        {/* ── Items */}
        <section className="border-b border-line">
          <div className="flex flex-wrap items-end gap-3 px-5 pb-3 pt-6 sm:px-7">
            <div className="flex-1">
              <h2 className="text-[15px] font-semibold text-ink">{s.sectionItems}</h2>
              <p className="mt-1 hidden text-[13px] text-ink-muted md:block">{s.sectionItemsDesc}</p>
            </div>
            {errors.lines && <p className="text-[13px] font-medium text-red-600">{errors.lines}</p>}
          </div>
          <div className="px-4 pb-4 sm:px-7">
            <ScanBar products={products} onProduct={onScanned} />
          </div>

          <div {...grid.containerProps}>
            {/* Desktop editable table */}
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
                    <th className="w-10" aria-label={s.removeItem} />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const re = rowErrors(l);
                    return (
                      <tr key={l.key} ref={rowRef(l.key)} className={cn("align-top", re.length && "bg-red-50/40")}>
                        <td className="py-2.5 text-[12px] text-ink-faint tabular">
                          <div className="pt-2.5">{i + 1}</div>
                        </td>
                        {cols.map((c) => (
                          <td key={c} className={cn("px-1.5 py-2", widths[c].includes("text-end") && "text-end")}>
                            {["total", "available", "onhand", "diff"].includes(c) ? <div className="pt-2.5">{cell(c, l)}</div> : cell(c, l)}
                          </td>
                        ))}
                        <td className="py-2 text-end">
                          <button
                            type="button"
                            onClick={() => remove(l.key)}
                            aria-label={s.removeItem}
                            className="mt-1 rounded-lg p-2 text-ink-faint hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* row-level error messages */}
              {lines.some((l) => rowErrors(l).length) && (
                <ul className="mt-1 space-y-0.5 text-[12.5px] font-medium text-red-600">
                  {lines.map((l, i) =>
                    rowErrors(l).length ? (
                      <li key={l.key}>
                        #{i + 1}: {rowErrors(l).join(" · ")}
                      </li>
                    ) : null,
                  )}
                </ul>
              )}
            </div>

            {/* Mobile cards */}
            <ul className="space-y-3 px-4 md:hidden">
              {lines.map((l, i) => (
                <li key={l.key} ref={rowRef(l.key)} className="rounded-card border border-line p-3.5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-ink-muted">#{i + 1}</span>
                    <button type="button" onClick={() => remove(l.key)} aria-label={s.removeItem} className="rounded-lg p-2 text-ink-faint hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    {cols.map((c) =>
                      ["total", "available", "onhand", "diff"].includes(c) ? (
                        <div key={c} className="flex items-center justify-between text-[13px]">
                          <span className="text-ink-muted">{headers[c]}</span>
                          {cell(c, l)}
                        </div>
                      ) : (
                        <Field key={c} label={headers[c]} error={err(l, c === "qty" ? "quantity" : c === "cost" ? "unitCost" : c === "expiry" ? "expiryDate" : c === "product" ? "productId" : "batchNumber")}>
                          {cell(c, l)}
                        </Field>
                      ),
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {lines.length === 0 && <EmptyState compact title={s.emptyItems} body={s.emptyItemsBody} />}
          </div>

          <div className="flex flex-col gap-4 px-5 pb-6 pt-3 sm:flex-row sm:items-start sm:px-7">
            <Button type="button" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={addRow} className="sm:w-auto">
              {s.addItem}
            </Button>
            <dl className="grid flex-1 grid-cols-3 gap-2 sm:ms-auto sm:max-w-md">
              {[
                { k: s.lines, v: formatNumber(filled.length) },
                { k: type === "ADJUSTMENT" ? s.difference : s.units, v: (type === "ADJUSTMENT" && totalUnits > 0 ? "+" : "") + formatNumber(+totalUnits.toFixed(3)) },
                { k: s.value, v: formatMoney(totalValue) },
              ].map((x) => (
                <div key={x.k} className="rounded-field bg-canvas px-3 py-2.5 text-end">
                  <dt className="text-[11.5px] font-medium uppercase tracking-wide text-ink-muted">{x.k}</dt>
                  <dd className="mt-0.5 text-[16px] font-semibold tabular text-ink" dir="ltr">
                    {x.v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <FormActions>
          <Button type="button" variant="secondary" onClick={() => guard("/stock")} disabled={posting}>
            {dict.common.cancel}
          </Button>
          <Button type="submit" loading={posting} loadingText={s.posting} icon={<Check className="h-4 w-4" />}>
            {s.post}
          </Button>
        </FormActions>
      </div>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={post}
        loading={posting}
        tone="primary"
        title={s.confirmTitle}
        body={t(s.confirmBody, { lines: filled.length, units: formatNumber(Math.abs(+totalUnits.toFixed(3))) })}
        confirmLabel={s.post}
        cancelLabel={dict.common.cancel}
      />
      {dialog}
    </form>
  );
}
