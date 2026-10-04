"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, KeyRound, UserRound } from "lucide-react";
import { SwitchField } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n/client";
import { LOCALES, LOCALE_LABELS } from "@/i18n/config";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Field, FormGrid } from "@/components/ui/field";
import { FormActions, FormSection } from "@/components/ui/form-section";
import { Input, Select } from "@/components/ui/input";
import { changePassword, saveNotificationPrefs, updateProfile } from "../settings/actions";

export function ProfileForm({ initial, email, role }: { initial: { name: string; phone: string; locale: string }; email: string; role: string }) {
  const { dict } = useI18n();
  const s = dict.settings;
  const toast = useToast();
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [base, setBase] = useState(JSON.stringify(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, start] = useTransition();
  const dirty = JSON.stringify(v) !== base;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    start(async () => {
      const res = await updateProfile(v);
      if (res.ok) {
        setBase(JSON.stringify(v));
        toast({ tone: "success", title: `✓ ${dict.common.savedToast}` });
        router.refresh();
      } else {
        setErrors(res.errors ?? {});
        toast({ tone: "error", title: res.message });
      }
    });
  };

  return (
    <form onSubmit={submit} noValidate className="zw-card">
      <FormSection title={s.sectionProfile} description={s.sectionProfileDesc} icon={<UserRound className="h-4 w-4" />} collapsible={false}>
        <FormGrid>
          <Field label={dict.employees.name} htmlFor="p-name" required error={errors.name}>
            <Input id="p-name" value={v.name} invalid={!!errors.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          </Field>
          <Field label={dict.employees.email} htmlFor="p-email">
            <Input id="p-email" value={email} disabled dir="ltr" />
          </Field>
          <Field label={dict.employees.phone} htmlFor="p-phone" error={errors.phone} optionalLabel={dict.common.optional}>
            <Input id="p-phone" value={v.phone} type="tel" dir="ltr" invalid={!!errors.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
          </Field>
          <Field label={s.language} htmlFor="p-locale">
            <Select id="p-locale" value={v.locale} onChange={(e) => setV({ ...v, locale: e.target.value })}>
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {LOCALE_LABELS[l].native}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={dict.employees.role} htmlFor="p-role">
            <Input id="p-role" value={role} disabled />
          </Field>
        </FormGrid>
      </FormSection>
      <FormActions>
        <Button type="submit" loading={busy} loadingText={dict.common.saving} disabled={!dirty} icon={<Check className="h-4 w-4" />}>
          {dict.common.saveChanges}
        </Button>
      </FormActions>
    </form>
  );
}

export function PasswordForm() {
  const { dict } = useI18n();
  const s = dict.settings;
  const toast = useToast();
  const [v, setV] = useState({ current: "", next: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    start(async () => {
      const res = await changePassword(v);
      if (res.ok) {
        setV({ current: "", next: "", confirm: "" });
        setErrors({});
        toast({ tone: "success", title: `✓ ${s.passwordChanged}` });
      } else {
        setErrors(res.errors ?? {});
        toast({ tone: "error", title: res.message });
      }
    });
  };

  const field = (k: keyof typeof v, label: string, auto: string) => (
    <Field label={label} htmlFor={`pw-${k}`} required error={errors[k]}>
      <Input
        id={`pw-${k}`}
        type="password"
        autoComplete={auto}
        dir="ltr"
        value={v[k]}
        invalid={!!errors[k]}
        onChange={(e) => {
          setV({ ...v, [k]: e.target.value });
          setErrors((x) => ({ ...x, [k]: "" }));
        }}
      />
    </Field>
  );

  return (
    <form onSubmit={submit} noValidate className="zw-card">
      <FormSection title={s.sectionPassword} description={s.sectionPasswordDesc} icon={<KeyRound className="h-4 w-4" />} collapsible={false}>
        <FormGrid>
          {field("current", s.currentPassword, "current-password")}
          <div className="hidden sm:block" />
          {field("next", s.newPassword, "new-password")}
          {field("confirm", s.confirmPassword, "new-password")}
        </FormGrid>
      </FormSection>
      <FormActions>
        <Button type="submit" loading={busy} loadingText={dict.common.saving} disabled={!v.current || !v.next} icon={<KeyRound className="h-4 w-4" />}>
          {s.changePassword}
        </Button>
      </FormActions>
    </form>
  );
}

export function NotificationPrefsForm({
  initial,
  email,
  phone,
  channels,
}: {
  initial: { email: boolean; whatsapp: boolean };
  email: string;
  phone: string | null;
  channels: { email: boolean; whatsapp: boolean };
}) {
  const { dict, t } = useI18n();
  const n = dict.notifications;
  const toast = useToast();
  const [v, setV] = useState(initial);
  const [busy, start] = useTransition();

  // save immediately — toggles don't need a separate Save button
  const set = (patch: Partial<typeof v>) => {
    const next = { ...v, ...patch };
    setV(next);
    start(async () => {
      const res = await saveNotificationPrefs(next);
      toast(res.ok ? { tone: "success", title: `✓ ${n.saved}` } : { tone: "error", title: dict.common.errorToast });
    });
  };

  const status = (on: boolean) => <Badge tone={on ? "green" : "gray"}>{on ? n.configured : n.notConfigured}</Badge>;

  return (
    <div className="zw-card">
      <FormSection title={n.channels} description={n.channelsDesc} icon={<Bell className="h-4 w-4" />} collapsible={false}>
        <div className="space-y-3">
          <SwitchField id="n-inapp" checked disabled onChange={() => {}} label={n.inApp} description={n.inAppDesc} />
          <div>
            <SwitchField
              id="n-email"
              checked={v.email}
              disabled={busy}
              onChange={(on) => set({ email: on })}
              label={n.email}
              description={t(n.emailDesc, { email })}
            />
            <div className="mt-1.5 ps-1">{status(channels.email)}</div>
          </div>
          <div>
            <SwitchField
              id="n-whatsapp"
              checked={v.whatsapp && !!phone}
              disabled={busy || !phone}
              onChange={(on) => set({ whatsapp: on })}
              label={n.whatsapp}
              description={phone ? t(n.whatsappDesc, { phone }) : n.whatsappNoPhone}
            />
            <div className="mt-1.5 ps-1">{status(channels.whatsapp)}</div>
          </div>
        </div>
      </FormSection>
    </div>
  );
}
