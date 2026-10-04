"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, KeyRound, ShieldCheck, UserRound, Warehouse as WarehouseIcon } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { useForm } from "@/hooks/use-form";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Field, FormGrid } from "@/components/ui/field";
import { FormActions, FormSection } from "@/components/ui/form-section";
import { Input, Select } from "@/components/ui/input";
import { SwitchField } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { saveEmployee } from "./actions";
import { employeeSchema, type EmployeeInput } from "./schema";

export function EmployeeForm({
  id,
  initial,
  roles,
  warehouses,
  isSelf,
}: {
  id?: string;
  initial: EmployeeInput;
  roles: { value: string; label: string; description?: string | null }[];
  warehouses: { value: string; label: string; meta?: string }[];
  isSelf?: boolean;
}) {
  const { dict } = useI18n();
  const e = dict.employees;
  const toast = useToast();
  const router = useRouter();
  const schema = useMemo(() => employeeSchema(dict, !id), [dict, id]);
  const form = useForm(initial, schema);
  const { guard, dialog } = useUnsavedChanges(form.dirty);
  const [saving, start] = useTransition();
  const [showPw, setShowPw] = useState(false);

  const toggleWh = (w: string) =>
    form.set(
      "warehouseIds",
      form.values.warehouseIds.includes(w) ? form.values.warehouseIds.filter((x) => x !== w) : [...form.values.warehouseIds, w],
    );

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (saving) return;
    const data = form.validate();
    if (!data) return void toast({ tone: "error", title: dict.validation.fixErrors });
    start(async () => {
      const res = await saveEmployee(id ?? null, data);
      if (!res.ok) {
        if (res.errors) form.setServerErrors(res.errors);
        return void toast({ tone: "error", title: res.message });
      }
      form.commit({ ...data, password: "" });
      toast({ tone: "success", title: `✓ ${id ? e.updated : e.created}` });
      router.push("/employees");
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} noValidate className="zw-card">
      <FormSection title={e.sectionAccount} description={e.sectionAccountDesc} icon={<UserRound className="h-4 w-4" />}>
        <FormGrid>
          <Field label={e.name} htmlFor="f-name" required error={form.errors.name} span={2}>
            <Input {...form.bind("name")} placeholder={e.namePh} autoFocus={!id} autoComplete="off" />
          </Field>
          <Field label={e.email} htmlFor="f-email" required error={form.errors.email}>
            <Input {...form.bind("email")} type="email" inputMode="email" dir="ltr" autoComplete="off" />
          </Field>
          <Field label={e.phone} htmlFor="f-phone" error={form.errors.phone} optionalLabel={dict.common.optional}>
            <Input {...form.bind("phone")} type="tel" inputMode="tel" dir="ltr" placeholder="+964 750 000 0000" />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title={e.sectionAccess} description={e.sectionAccessDesc} icon={<ShieldCheck className="h-4 w-4" />}>
        <div className="space-y-5">
          <Field label={e.role} htmlFor="f-roleId" required error={form.errors.roleId}>
            <Select {...form.bind("roleId")} disabled={isSelf} placeholder={dict.common.choose}>
              {roles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={e.warehouses} hint={e.warehousesHint}>
            <div className="flex flex-wrap gap-2">
              {warehouses.map((w) => {
                const on = form.values.warehouseIds.includes(w.value);
                return (
                  <button
                    key={w.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleWh(w.value)}
                    className={cn(
                      "inline-flex h-10 items-center gap-2 rounded-field border px-3 text-[13.5px] font-medium transition-colors",
                      on ? "border-brand-400 bg-brand-50 text-brand-800" : "border-line-strong bg-white text-ink-soft hover:bg-canvas",
                    )}
                  >
                    {on ? <Check className="h-4 w-4" /> : <WarehouseIcon className="h-4 w-4 text-ink-faint" />}
                    {w.label}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>
      </FormSection>

      <FormSection title={e.sectionSecurity} description={e.sectionSecurityDesc} icon={<KeyRound className="h-4 w-4" />}>
        <FormGrid>
          <Field
            label={id ? e.newPassword : e.password}
            htmlFor="f-password"
            required={!id}
            error={form.errors.password}
            hint={id ? e.passwordEditHint : e.passwordHint}
          >
            <div className="relative">
              <Input {...form.bind("password")} type={showPw ? "text" : "password"} autoComplete="new-password" dir="ltr" className="pe-20" />
              <button
                type="button"
                onClick={() => setShowPw((x) => !x)}
                className="absolute inset-y-0 end-0 px-3 text-[12.5px] font-medium text-brand-700"
              >
                {showPw ? dict.auth.hide : dict.auth.show}
              </button>
            </div>
          </Field>
          <div className="sm:pt-6">
            <SwitchField
              id="f-status"
              checked={form.values.status === "ACTIVE"}
              onChange={(on) => form.set("status", on ? "ACTIVE" : "INACTIVE")}
              label={dict.status.ACTIVE}
              description={e.deactivateBody}
              disabled={isSelf}
            />
          </div>
        </FormGrid>
      </FormSection>

      <FormActions>
        <Button type="button" variant="secondary" onClick={() => guard("/employees")} disabled={saving}>
          {dict.common.cancel}
        </Button>
        <Button type="submit" loading={saving} loadingText={dict.common.saving} disabled={!!id && !form.dirty} icon={<Check className="h-4 w-4" />}>
          {id ? dict.common.saveChanges : e.create}
        </Button>
      </FormActions>
      {dialog}
    </form>
  );
}
