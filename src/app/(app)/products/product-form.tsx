"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Boxes, Check, DollarSign, ImageIcon, NotebookPen, Package, Plus, RotateCcw } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { useForm } from "@/hooks/use-form";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Field, FormGrid } from "@/components/ui/field";
import { FormActions, FormSection } from "@/components/ui/form-section";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { SwitchField } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { createProduct, updateProduct } from "./actions";
import { productSchema, PRODUCT_STATUSES, type ProductInput } from "./schema";

/**
 * One form for Add and Edit. Four sections:
 * Product Information · Pricing · Inventory · Additional
 */
export function ProductForm({
  mode,
  id,
  initial,
  categories,
  units,
  footerNote,
  canManageCatalog,
}: {
  mode: "create" | "edit";
  id?: string;
  initial: ProductInput;
  categories: ComboOption[];
  units: ComboOption[];
  footerNote?: string;
  canManageCatalog?: boolean;
}) {
  const { dict } = useI18n();
  const p = dict.products;
  const opt = dict.common.optional;
  const toast = useToast();
  const router = useRouter();
  const schema = useMemo(() => productSchema(dict), [dict]);
  const form = useForm(initial, schema);
  const { guard, dialog } = useUnsavedChanges(form.dirty);
  const [saving, start] = useTransition();
  const back = mode === "edit" ? `/products/${id}` : "/products";

  const buy = Number(form.values.purchasePrice) || 0;
  const sell = Number(form.values.sellingPrice) || 0;
  const margin = sell > 0 ? ((sell - buy) / sell) * 100 : null;
  const belowCost = buy > 0 && sell > 0 && sell < buy;
  const unitSymbol = units.find((u) => u.value === form.values.unitId)?.label.match(/\(([^)]+)\)/)?.[1];

  const submit = (e: React.FormEvent, addAnother = false) => {
    e.preventDefault();
    if (saving) return;
    const data = form.validate();
    if (!data) {
      toast({ tone: "error", title: dict.validation.fixErrors });
      return;
    }
    start(async () => {
      const res = mode === "edit" ? await updateProduct(id!, data) : await createProduct(data);
      if (!res.ok) {
        if (res.errors) form.setServerErrors(res.errors);
        toast({ tone: "error", title: res.message });
        return;
      }
      form.commit(data);
      toast({ tone: "success", title: `✓ ${mode === "edit" ? p.updated : p.created}` });
      if (addAnother) {
        router.refresh(); // new code comes from the server
        router.replace(`/products/new?t=${Date.now()}`);
      } else {
        router.push(`/products/${res.id}`);
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={submit} noValidate className="zw-card">
      {/* ── Product Information */}
      <FormSection title={p.sectionInfo} description={p.sectionInfoDesc} icon={<Package className="h-4 w-4" />}>
        <FormGrid cols={3}>
          <Field label={p.name} htmlFor="f-name" required error={form.errors.name} span={2}>
            <Input {...form.bind("name")} placeholder={p.namePh} autoFocus={mode === "create"} />
          </Field>
          <Field label={p.code} htmlFor="f-code" required error={form.errors.code} hint={p.codeHint}>
            <Input {...form.bind("code")} className="font-mono uppercase" dir="ltr" />
          </Field>
          <Field label={p.category} htmlFor="f-categoryId" optionalLabel={opt}>
            <Combobox
              id="f-categoryId"
              options={categories}
              value={form.values.categoryId || null}
              onChange={(v) => form.set("categoryId", v ?? "")}
              placeholder={p.categoryPh}
              emptyText={dict.common.noResults}
            />
          </Field>
          <Field label={p.unit} htmlFor="f-unitId" required error={form.errors.unitId}>
            <Select {...form.bind("unitId")} placeholder={p.unitPh}>
              {units.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={p.barcode} htmlFor="f-barcode" error={form.errors.barcode} optionalLabel={opt}>
            <Input {...form.bind("barcode")} placeholder={p.barcodePh} dir="ltr" className="font-mono" />
          </Field>
        </FormGrid>
        {canManageCatalog && (
          <a href="/products/catalog" className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:underline">
            <Plus className="h-3.5 w-3.5" />
            {p.manageCatalog}
          </a>
        )}
      </FormSection>

      {/* ── Pricing */}
      <FormSection title={p.sectionPricing} description={p.sectionPricingDesc} icon={<DollarSign className="h-4 w-4" />}>
        <FormGrid cols={2}>
          <Field label={p.purchasePrice} htmlFor="f-purchasePrice" required error={form.errors.purchasePrice}>
            <Input {...form.bind("purchasePrice")} type="number" inputMode="decimal" step="0.01" min={0} prefix="$" placeholder="0.00" dir="ltr" />
          </Field>
          <Field label={p.sellingPrice} htmlFor="f-sellingPrice" required error={form.errors.sellingPrice}>
            <Input {...form.bind("sellingPrice")} type="number" inputMode="decimal" step="0.01" min={0} prefix="$" placeholder="0.00" dir="ltr" />
          </Field>
          <Field label={p.discount} htmlFor="f-discountRate" error={form.errors.discountRate}>
            <Input {...form.bind("discountRate")} type="number" inputMode="decimal" step="0.01" min={0} max={100} suffix="%" dir="ltr" />
          </Field>
          <Field label={p.tax} htmlFor="f-taxRate" error={form.errors.taxRate}>
            <Input {...form.bind("taxRate")} type="number" inputMode="decimal" step="0.01" min={0} max={100} suffix="%" dir="ltr" />
          </Field>
        </FormGrid>
        {/* live margin */}
        <div
          className={cn(
            "mt-4 flex items-center gap-3 rounded-field border px-4 py-3 text-[13.5px]",
            belowCost ? "border-amber-200 bg-amber-50 text-amber-800" : "border-line bg-canvas/60 text-ink-soft",
          )}
        >
          {belowCost && <AlertTriangle className="h-4 w-4 shrink-0" />}
          <span className="flex-1">{belowCost ? dict.validation.sellBelowCost : p.margin}</span>
          <span className="font-semibold tabular" dir="ltr">
            {margin === null ? "—" : `${margin.toFixed(1)}%`}
            {sell > 0 && <span className="ms-2 font-normal text-ink-muted">(${(sell - buy).toFixed(2)})</span>}
          </span>
        </div>
      </FormSection>

      {/* ── Inventory */}
      <FormSection title={p.sectionInventory} description={p.sectionInventoryDesc} icon={<Boxes className="h-4 w-4" />}>
        <FormGrid cols={2}>
          <Field label={p.minQuantity} htmlFor="f-minQuantity" error={form.errors.minQuantity} hint={p.minQuantityHint}>
            <Input {...form.bind("minQuantity")} type="number" inputMode="decimal" min={0} suffix={unitSymbol} placeholder="0" dir="ltr" />
          </Field>
          <div className="hidden sm:block" />
          <SwitchField
            id="f-tracksBatch"
            checked={form.values.tracksBatch}
            onChange={(v) => form.set("tracksBatch", v)}
            label={p.tracksBatch}
            description={p.tracksBatchDesc}
          />
          <SwitchField
            id="f-tracksExpiry"
            checked={form.values.tracksExpiry}
            onChange={(v) => form.set("tracksExpiry", v)}
            label={p.tracksExpiry}
            description={p.tracksExpiryDesc}
          />
        </FormGrid>
      </FormSection>

      {/* ── Additional */}
      <FormSection title={p.sectionAdditional} description={p.sectionAdditionalDesc} icon={<NotebookPen className="h-4 w-4" />}>
        <FormGrid cols={2}>
          <Field label={p.description} htmlFor="f-description" error={form.errors.description} span={2} optionalLabel={opt}>
            <Textarea {...form.bind("description")} rows={3} placeholder={p.descriptionPh} />
          </Field>
          <Field label={p.image} htmlFor="f-imageUrl" error={form.errors.imageUrl} hint={p.imageHint} optionalLabel={opt}>
            <div className="flex gap-3">
              <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center overflow-hidden rounded-field border border-line bg-canvas">
                {/^https?:\/\//.test(form.values.imageUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.values.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-4 w-4 text-ink-faint" />
                )}
              </span>
              <div className="flex-1">
                <Input {...form.bind("imageUrl")} type="url" placeholder="https://" dir="ltr" />
              </div>
            </div>
          </Field>
          <Field label={dict.common.status} htmlFor="f-status" required>
            <Select {...form.bind("status")}>
              {PRODUCT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {dict.status[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={dict.common.notes} htmlFor="f-notes" error={form.errors.notes} span={2} optionalLabel={opt}>
            <Textarea {...form.bind("notes")} rows={3} placeholder={p.notesPh} />
          </Field>
        </FormGrid>
      </FormSection>

      <FormActions start={footerNote}>
        {form.dirty && (
          <Button type="button" variant="ghost" icon={<RotateCcw className="h-4 w-4" />} onClick={form.reset} disabled={saving}>
            {dict.common.reset}
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={() => guard(back)} disabled={saving}>
          {dict.common.cancel}
        </Button>
        {mode === "create" && (
          <Button type="button" variant="secondary" onClick={(e) => submit(e, true)} disabled={saving}>
            <Plus className="h-4 w-4" />
            {dict.common.saveAndNew}
          </Button>
        )}
        <Button
          type="submit"
          loading={saving}
          loadingText={dict.common.saving}
          disabled={mode === "edit" && !form.dirty}
          icon={<Check className="h-4 w-4" />}
        >
          {mode === "edit" ? dict.common.saveChanges : p.create}
        </Button>
      </FormActions>
      {dialog}
    </form>
  );
}
