export const LOCALES = ["en", "ckb", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const RTL_LOCALES: Locale[] = ["ckb", "ar"];
export const LOCALE_LABELS: Record<Locale, { native: string; short: string }> = {
  en: { native: "English", short: "EN" },
  ckb: { native: "کوردی", short: "KU" },
  ar: { native: "العربية", short: "AR" },
};
export const isRtl = (l: Locale) => RTL_LOCALES.includes(l);

/** "{n} active" + {n: 3} → "3 active" */
export function interpolate(str: string, vars?: Record<string, string | number>) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}
