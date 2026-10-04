"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, NotebookPen, Phone, RotateCcw } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { useForm } from "@/hooks/use-form";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Field, FormGrid } from "@/components/ui/field";
import { FormActions, FormSection } from "@/components/ui/form-section";
import { Input, Select, Textarea } from "@/components/ui/input";
import { saveSupplier } from "./actions";
import { supplierSchema, SUPPLIER_STATUSES, type SupplierInput } from "./schema";

export function SupplierForm({ id, initial, footerNote }: { id?: string; initial: SupplierInput; footerNote?: string }) {
  const { dict } = useI18n();
  const s = dict.suppliers;
  const opt = dict.common.optional;
  const toast = useToast();
  const router = useRouter();
  const schema = useMemo(() => supplierSchema(dict), [dict]);
  const form = useForm(initial, schema);
  const { guard, dialog } = useUnsavedChanges(form.dirty);
  const [saving, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const data = form.validate();
    if (!data) return void toast({ tone: "error", title: dict.validation.fixErrors });
    start(async () => {
      const res = await saveSupplier(id ?? null, data);
      if (!res.ok) {
        if (res.errors) form.setServerErrors(res.errors);
        return void toast({ tone: "error", title: res.message });
      }
      form.commit(data);
      toast({ tone: "success", title: `✓ ${id ? s.updated : s.created}` });
      router.push(`/suppliers/${res.id}`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} noValidate className="zw-card">
      <FormSection title={s.sectionInfo} description={s.sectionInfoDesc} icon={<Building2 className="h-4 w-4" />}>
        <FormGrid>
          <Field label={s.name} htmlFor="f-name" required error={form.errors.name} span={2}>
            <Input {...form.bind("name")} placeholder={s.namePh} autoFocus={!id} />
          </Field>
          <Field label={s.code} htmlFor="f-code" required error={form.errors.code} hint={s.codeHint}>
            <Input {...form.bind("code")} className="font-mono uppercase" dir="ltr" />
          </Field>
          <Field label={dict.common.status} htmlFor="f-status" required>
            <Select {...form.bind("status")}>
              {SUPPLIER_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {dict.status[st]}
                </option>
              ))}
            </Select>
          </Field>
        </FormGrid>
      </FormSection>
      <FormSection title={s.sectionContact} description={s.sectionContactDesc} icon={<Phone className="h-4 w-4" />}>
        <FormGrid>
          <Field label={s.contactName} htmlFor="f-contactName" error={form.errors.contactName} optionalLabel={opt}>
            <Input {...form.bind("contactName")} />
          </Field>
          <Field label={s.phone} htmlFor="f-phone" error={form.errors.phone} optionalLabel={opt}>
            <Input {...form.bind("phone")} type="tel" inputMode="tel" dir="ltr" placeholder="+964 750 000 0000" />
          </Field>
          <Field label={s.email} htmlFor="f-email" error={form.errors.email} optionalLabel={opt}>
            <Input {...form.bind("email")} type="email" inputMode="email" dir="ltr" />
          </Field>
          <Field label={s.city} htmlFor="f-city" error={form.errors.city} optionalLabel={opt}>
            <Input {...form.bind("city")} />
          </Field>
          <Field label={s.address} htmlFor="f-address" error={form.errors.address} span={2} optionalLabel={opt}>
            <Input {...form.bind("address")} />
          </Field>
        </FormGrid>
      </FormSection>
      <FormSection title={s.sectionAdditional} description={s.sectionAdditionalDesc} icon={<NotebookPen className="h-4 w-4" />}>
        <FormGrid>
          <Field label={s.taxNumber} htmlFor="f-taxNumber" error={form.errors.taxNumber} optionalLabel={opt}>
            <Input {...form.bind("taxNumber")} dir="ltr" className="font-mono" />
          </Field>
          <div className="hidden sm:block" />
          <Field label={dict.common.notes} htmlFor="f-notes" error={form.errors.notes} span={2} optionalLabel={opt}>
            <Textarea {...form.bind("notes")} rows={3} placeholder={s.notesPh} />
          </Field>
        </FormGrid>
      </FormSection>
      <FormActions start={footerNote}>
        {form.dirty && (
          <Button type="button" variant="ghost" icon={<RotateCcw className="h-4 w-4" />} onClick={form.reset} disabled={saving}>
            {dict.common.reset}
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={() => guard(id ? `/suppliers/${id}` : "/suppliers")} disabled={saving}>
          {dict.common.cancel}
        </Button>
        <Button type="submit" loading={saving} loadingText={dict.common.saving} disabled={!!id && !form.dirty} icon={<Check className="h-4 w-4" />}>
          {id ? dict.common.saveChanges : s.create}
        </Button>
      </FormActions>
      {dialog}
    </form>
  );
}
