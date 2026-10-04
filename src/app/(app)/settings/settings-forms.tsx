"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Building2, Check, FileText } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { useToast } from "@/components/ui/toast";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { Button } from "@/components/ui/button";
import { Field, FormGrid } from "@/components/ui/field";
import { FormActions, FormSection } from "@/components/ui/form-section";
import { Input, Select } from "@/components/ui/input";
import { DOC_TYPES } from "@/lib/documents";
import { saveAppSettings, saveCompany, type CompanyInput } from "./actions";

const CURRENCIES = ["USD", "IQD", "EUR", "TRY", "GBP", "AED"];

function useSimpleForm<T extends Record<string, string>>(initial: T) {
  const [values, setValues] = useState(initial);
  const [base, setBase] = useState(JSON.stringify(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = JSON.stringify(values) !== base;
  const bind = (k: keyof T & string) => ({
    id: `f-${k}`,
    value: values[k],
    invalid: !!errors[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setValues((v) => ({ ...v, [k]: e.target.value }));
      setErrors((x) => ({ ...x, [k]: "" }));
    },
  });
  return { values, errors, setErrors, dirty, bind, commit: () => setBase(JSON.stringify(values)) };
}

export function CompanyForm({ initial, readOnly }: { initial: CompanyInput; readOnly: boolean }) {
  const { dict } = useI18n();
  const s = dict.settings;
  const toast = useToast();
  const router = useRouter();
  const f = useSimpleForm(initial);
  const { dialog } = useUnsavedChanges(f.dirty);
  const [busy, start] = useTransition();
  const opt = dict.common.optional;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || readOnly) return;
    start(async () => {
      const res = await saveCompany(f.values);
      if (res.ok) {
        f.commit();
        toast({ tone: "success", title: `✓ ${s.saved}` });
        router.refresh();
      } else {
        f.setErrors(res.errors ?? {});
        toast({ tone: "error", title: res.message });
      }
    });
  };

  return (
    <form onSubmit={submit} noValidate className="zw-card">
      <fieldset disabled={readOnly}>
        <FormSection title={s.sectionCompany} description={s.sectionCompanyDesc} icon={<Building2 className="h-4 w-4" />} collapsible={false}>
          <FormGrid>
            <Field label={s.companyName} htmlFor="f-name" required error={f.errors.name}>
              <Input {...f.bind("name")} />
            </Field>
            <Field label={s.legalName} htmlFor="f-legalName" optionalLabel={opt}>
              <Input {...f.bind("legalName")} />
            </Field>
            <Field label={s.taxNumber} htmlFor="f-taxNumber" optionalLabel={opt}>
              <Input {...f.bind("taxNumber")} dir="ltr" className="font-mono" />
            </Field>
            <Field label={s.currency} htmlFor="f-currency" required hint={s.currencyHint} error={f.errors.currency}>
              <Select {...f.bind("currency")}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={s.phone} htmlFor="f-phone" error={f.errors.phone} optionalLabel={opt}>
              <Input {...f.bind("phone")} type="tel" dir="ltr" />
            </Field>
            <Field label={s.email} htmlFor="f-email" error={f.errors.email} optionalLabel={opt}>
              <Input {...f.bind("email")} type="email" dir="ltr" />
            </Field>
            <Field label={s.address} htmlFor="f-address" span={2} optionalLabel={opt}>
              <Input {...f.bind("address")} />
            </Field>
          </FormGrid>
        </FormSection>
      </fieldset>
      {!readOnly && (
        <FormActions>
          <Button type="submit" loading={busy} loadingText={dict.common.saving} disabled={!f.dirty} icon={<Check className="h-4 w-4" />}>
            {dict.common.saveChanges}
          </Button>
        </FormActions>
      )}
      {dialog}
    </form>
  );
}

export function AppSettingsForm({
  initial,
  readOnly,
}: {
  initial: { defaultDocType: string; defaultTaxRate: string; expiryWarningDays: string };
  readOnly: boolean;
}) {
  const { dict } = useI18n();
  const s = dict.settings;
  const toast = useToast();
  const router = useRouter();
  const f = useSimpleForm(initial);
  const { dialog } = useUnsavedChanges(f.dirty);
  const [busy, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || readOnly) return;
    start(async () => {
      const res = await saveAppSettings(f.values);
      if (res.ok) {
        f.commit();
        toast({ tone: "success", title: `✓ ${s.saved}` });
        router.refresh();
      } else {
        f.setErrors(res.errors ?? {});
        toast({ tone: "error", title: res.message });
      }
    });
  };

  return (
    <form onSubmit={submit} noValidate className="zw-card">
      <fieldset disabled={readOnly}>
        <FormSection title={s.sectionDocs} description={s.sectionDocsDesc} icon={<FileText className="h-4 w-4" />} collapsible={false}>
          <FormGrid>
            <Field label={s.defaultDocType} htmlFor="f-defaultDocType" error={f.errors.defaultDocType}>
              <Select {...f.bind("defaultDocType")}>
                {DOC_TYPES.map((tp) => (
                  <option key={tp} value={tp}>
                    {dict.docType[tp]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={s.defaultTaxRate} htmlFor="f-defaultTaxRate" hint={s.defaultTaxRateHint} error={f.errors.defaultTaxRate}>
              <Input {...f.bind("defaultTaxRate")} type="number" min={0} max={100} step="0.01" suffix="%" dir="ltr" />
            </Field>
          </FormGrid>
        </FormSection>
        <FormSection title={s.sectionStock} description={s.sectionStockDesc} icon={<Bell className="h-4 w-4" />} collapsible={false}>
          <FormGrid>
            <Field label={s.expiryWarningDays} htmlFor="f-expiryWarningDays" hint={s.expiryWarningDaysHint} error={f.errors.expiryWarningDays}>
              <Input {...f.bind("expiryWarningDays")} type="number" min={1} max={730} suffix={s.days} dir="ltr" />
            </Field>
          </FormGrid>
        </FormSection>
      </fieldset>
      {!readOnly && (
        <FormActions>
          <Button type="submit" loading={busy} loadingText={dict.common.saving} disabled={!f.dirty} icon={<Check className="h-4 w-4" />}>
            {dict.common.saveChanges}
          </Button>
        </FormActions>
      )}
      {dialog}
    </form>
  );
}
