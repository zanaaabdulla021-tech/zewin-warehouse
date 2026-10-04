"use client";

import { createContext, useContext } from "react";
import type { Dictionary } from "./en";
import { interpolate, type Locale } from "./config";

type Ctx = { locale: Locale; dict: Dictionary };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ locale, dict, children }: Ctx & { children: React.ReactNode }) {
  return <I18nContext.Provider value={{ locale, dict }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return { ...ctx, t: interpolate };
}
