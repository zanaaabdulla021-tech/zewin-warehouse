"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { AlertCircle, ArrowRight, Boxes, FileCheck2, Globe, ShieldCheck } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { LOCALES, LOCALE_LABELS } from "@/i18n/config";
import { setLocale } from "@/app/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Logo, LogoMark } from "@/components/layout/logo";

export function LoginForm({ callbackUrl, demo }: { callbackUrl: string; demo: { email: string; role: string }[] }) {
  const { dict, locale, t } = useI18n();
  const a = dict.auth;
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<{ email?: string; password?: string }>({});
  const [loading, start] = useTransition();
  const [, startLocale] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const errs: typeof fieldErr = {};
    if (!email.trim()) errs.email = t(dict.validation.required, { field: a.email });
    if (!password) errs.password = t(dict.validation.required, { field: a.password });
    setFieldErr(errs);
    setError(null);
    if (Object.keys(errs).length) return;
    start(async () => {
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.ok && !res.error) {
        router.replace(callbackUrl.startsWith("/") ? callbackUrl : "/");
        router.refresh();
      } else {
        setError(a.invalid);
      }
    });
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-brand-900 p-12 text-white lg:flex lg:flex-col">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
          aria-hidden
        />
        <div className="pointer-events-none absolute -bottom-40 -end-40 h-[520px] w-[520px] rounded-full bg-brand-500/30 blur-3xl" aria-hidden />
        <div className="relative flex items-center gap-3">
          <LogoMark className="h-10 w-10 [&_rect]:fill-white [&_path]:stroke-brand-800 [&_circle]:fill-brand-400" />
          <div className="leading-none">
            <div className="text-[18px] font-bold tracking-[0.16em]" dir="ltr">ZEWIN</div>
            <div className="mt-1 text-[12px] text-brand-200">{dict.app.tagline}</div>
          </div>
        </div>
        <div className="relative mt-auto max-w-md">
          <h2 className="text-[34px] font-semibold leading-tight tracking-tight">{a.heroTitle}</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-brand-100/80">{a.heroBody}</p>
          <ul className="mt-10 grid grid-cols-3 gap-3">
            {[
              { icon: Boxes, label: dict.nav.stock },
              { icon: FileCheck2, label: dict.nav.documents },
              { icon: ShieldCheck, label: dict.nav.accounting },
            ].map((f) => (
              <li key={f.label} className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <f.icon className="h-5 w-5 text-brand-300" />
                <div className="mt-3 text-[13px] font-medium">{f.label}</div>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Form */}
      <main className="flex flex-col bg-white px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <div className="lg:invisible">
            <Logo tagline={dict.app.tagline} />
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-line p-1">
            <Globe className="mx-1.5 h-4 w-4 text-ink-faint" />
            {LOCALES.map((l) => (
              <button
                key={l}
                onClick={() => startLocale(() => setLocale(l))}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[12.5px] font-medium",
                  l === locale ? "bg-ink text-white" : "text-ink-muted hover:text-ink",
                )}
              >
                {LOCALE_LABELS[l].native}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
          <h1 className="text-[26px] font-semibold tracking-tight text-ink">{a.welcome}</h1>
          <p className="mt-1.5 text-[14.5px] text-ink-muted">{a.subtitle}</p>

          {error && (
            <div role="alert" className="mt-6 flex items-center gap-2 rounded-field border border-red-200 bg-red-50 px-3.5 py-3 text-[13.5px] font-medium text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={submit} noValidate className="mt-6 space-y-5">
            <Field label={a.email} htmlFor="email" error={fieldErr.email}>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoFocus
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={a.emailPh}
                invalid={!!fieldErr.email}
                className="h-12"
              />
            </Field>
            <Field label={a.password} htmlFor="password" error={fieldErr.password}>
              <div className="relative">
                <Input
                  id="password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  invalid={!!fieldErr.password}
                  className="h-12 pe-20"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute inset-y-0 end-0 px-4 text-[12.5px] font-medium text-brand-700 hover:text-brand-800"
                >
                  {show ? a.hide : a.show}
                </button>
              </div>
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={loading} loadingText={a.signingIn}>
              {a.signIn}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Button>
          </form>

          {demo.length > 0 && (
            <div className="mt-10">
              <div className="flex items-center gap-3 text-[12px] font-semibold uppercase tracking-wide text-ink-faint">
                <span className="h-px flex-1 bg-line" />
                {a.demo}
                <span className="h-px flex-1 bg-line" />
              </div>
              <div className="mt-3 grid gap-1.5">
                {demo.map((d) => (
                  <button
                    key={d.email}
                    type="button"
                    onClick={() => {
                      setEmail(d.email);
                      setPassword("zewin123");
                      setFieldErr({});
                      setError(null);
                    }}
                    className={cn(
                      "flex items-center justify-between rounded-lg border px-3 py-2 text-start text-[13px] transition-colors",
                      email === d.email ? "border-brand-300 bg-brand-50" : "border-line hover:bg-canvas",
                    )}
                  >
                    <span className="font-medium text-ink-soft" dir="ltr">{d.email}</span>
                    <span className="text-[12px] text-ink-muted">{d.role}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-center text-[12px] text-ink-faint">{a.demoHint}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
