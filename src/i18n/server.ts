import "server-only";
import { cookies } from "next/headers";
import en, { type Dictionary } from "./en";
import ckb from "./ckb";
import ar from "./ar";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "./config";

const DICTS: Record<Locale, Dictionary> = { en, ckb, ar };

export function getLocale(): Locale {
  const v = cookies().get("zw_locale")?.value as Locale | undefined;
  return v && LOCALES.includes(v) ? v : DEFAULT_LOCALE;
}

export function getDict(locale: Locale = getLocale()): Dictionary {
  return DICTS[locale];
}
