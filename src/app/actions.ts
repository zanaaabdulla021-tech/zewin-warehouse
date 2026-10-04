"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALES, type Locale } from "@/i18n/config";

const YEAR = 60 * 60 * 24 * 365;

export async function setLocale(locale: Locale) {
  if (!LOCALES.includes(locale)) return;
  cookies().set("zw_locale", locale, { path: "/", maxAge: YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
}
