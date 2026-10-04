import "server-only";
import { cache } from "react";
import { prisma } from "./prisma";
import { DOC_TYPES, type DocType } from "./documents";

export type AppSettings = {
  defaultDocType: DocType;
  defaultTaxRate: number;
  expiryWarningDays: number;
};

export const DEFAULT_SETTINGS: AppSettings = { defaultDocType: "PURCHASE", defaultTaxRate: 0, expiryWarningDays: 60 };

/** App-wide settings stored as one JSON row; unknown/invalid values fall back to defaults. */
export const getAppSettings = cache(async (): Promise<AppSettings> => {
  const row = await prisma.setting.findUnique({ where: { key: "app" } });
  const v = (row?.value ?? {}) as Partial<AppSettings>;
  return {
    defaultDocType: DOC_TYPES.includes(v.defaultDocType as DocType) ? (v.defaultDocType as DocType) : DEFAULT_SETTINGS.defaultDocType,
    defaultTaxRate: typeof v.defaultTaxRate === "number" && v.defaultTaxRate >= 0 && v.defaultTaxRate <= 100 ? v.defaultTaxRate : 0,
    expiryWarningDays:
      typeof v.expiryWarningDays === "number" && v.expiryWarningDays >= 1 && v.expiryWarningDays <= 730 ? v.expiryWarningDays : 60,
  };
});
