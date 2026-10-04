"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, MapPin, NotebookPen, RotateCcw } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { useForm } from "@/hooks/use-form";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Field, FormGrid } from "@/components/ui/field";
import { FormActions, FormSection } from "@/components/ui/form-section";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { updateWarehouse } from "../../actions";
import { warehouseSchema, WAREHOUSE_STATUSES, WAREHOUSE_TYPES, type WarehouseInput } from "../../schema";

export function WarehouseForm({
  id,
  initial,
  managers,
  lastUpdated,
}: {
  id: string;
  initial: WarehouseInput;
  managers: ComboOption[];
  lastUpdated: string;
}) {
  const { dict } = useI18n();
  const w = dict.warehouses;
  const toast = useToast();
  const router = useRouter();
  const schema = useMemo(() => warehouseSchema(dict), [dict]);
  const form = useForm(initial, schema);
  const { guard, dialog } = useUnsavedChanges(form.dirty);
  const [saving, start] = useTransition();
  const opt = dict.common.optional;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return; // no duplicate submissions
    const data = form.validate();
    if (!data) {
      toast({ tone: "error", title: dict.validation.fixErrors });
      return;
    }
    start(async () => {
      const res = await updateWarehouse(id, data);
      if (res.ok) {
        form.commit(data);
        toast({ tone: "success", title: `✓ ${w.updated}` });
        router.push(`/warehouses/${id}`);
        router.refresh();
      } else {
        if (res.errors) form.setServerErrors(res.errors);
        toast({ tone: "error", title: res.message });
      }
    });
  };

  return (
    <form onSubmit={submit} noValidate className="zw-card">
      <FormSection title={w.sectionBasic} description={w.sectionBasicDesc} icon={<Building2 className="h-4 w-4" />}>
        <FormGrid>
          <Field label={w.name} htmlFor="f-name" required error={form.errors.name} span={2}>
            <Input {...form.bind("name")} placeholder={w.namePh} />
          </Field>
          <Field label={w.code} htmlFor="f-code" required error={form.errors.code} hint={w.codeHint}>
            <Input {...form.bind("code")} className="font-mono uppercase" dir="ltr" />
          </Field>
          <Field label={w.type} htmlFor="f-type" required>
            <Select {...form.bind("type")}>
              {WAREHOUSE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {w.types[t]}
                </option>
              ))}
            </Select>
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title={w.sectionLocation} description={w.sectionLocationDesc} icon={<MapPin className="h-4 w-4" />}>
        <FormGrid>
          <Field label={w.city} htmlFor="f-city" error={form.errors.city} optionalLabel={opt}>
            <Input {...form.bind("city")} placeholder={w.cityPh} />
          </Field>
          <Field label={w.phone} htmlFor="f-phone" error={form.errors.phone} optionalLabel={opt}>
            <Input {...form.bind("phone")} type="tel" inputMode="tel" dir="ltr" placeholder="+964 750 000 0000" />
          </Field>
          <Field label={w.address} htmlFor="f-address" error={form.errors.address} span={2} optionalLabel={opt}>
            <Input {...form.bind("address")} placeholder={w.addressPh} />
          </Field>
          <Field label={w.manager} htmlFor="f-managerId" span={2} optionalLabel={opt}>
            <Combobox
              id="f-managerId"
              options={managers}
              value={form.values.managerId || null}
              onChange={(v) => form.set("managerId", v ?? "")}
              placeholder={w.managerPh}
              emptyText={dict.common.noResults}
            />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title={w.sectionAdditional} description={w.sectionAdditionalDesc} icon={<NotebookPen className="h-4 w-4" />}>
        <FormGrid>
          <Field label={w.capacity} htmlFor="f-capacity" error={form.errors.capacity} hint={w.capacityHint} optionalLabel={opt}>
            <Input {...form.bind("capacity")} type="number" inputMode="numeric" min={0} placeholder="0" dir="ltr" />
          </Field>
          <Field label={dict.common.status} htmlFor="f-status" required>
            <Select {...form.bind("status")}>
              {WAREHOUSE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {dict.status[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={dict.common.notes} htmlFor="f-notes" error={form.errors.notes} span={2} optionalLabel={opt}>
            <Textarea {...form.bind("notes")} rows={4} placeholder={w.notesPh} />
          </Field>
        </FormGrid>
      </FormSection>

      <FormActions start={`${dict.common.lastUpdated}: ${lastUpdated}`}>
        {form.dirty && (
          <Button type="button" variant="ghost" icon={<RotateCcw className="h-4 w-4" />} onClick={form.reset} disabled={saving}>
            {dict.common.reset}
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={() => guard(`/warehouses/${id}`)} disabled={saving}>
          {dict.common.cancel}
        </Button>
        <Button type="submit" loading={saving} loadingText={dict.common.saving} disabled={!form.dirty} icon={<Check className="h-4 w-4" />}>
          {dict.common.saveChanges}
        </Button>
      </FormActions>
      {dialog}
    </form>
  );
}
