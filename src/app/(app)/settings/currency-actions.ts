"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { getBaseCurrencyCode } from "@/lib/utils";
import { getDict } from "@/i18n/server";
import { interpolate as t } from "@/i18n/config";

type Result = { ok: true } | { ok: false; message: string; errors?: Record<string, string> };

export async function saveCurrency(
  existing: string | null,
  input: { code: string; name: string; symbol: string; rate: string; active: boolean },
): Promise<Result> {
  const user = await getSessionUser();
  const dict = getDict();
  const v = dict.validation;
  const c = dict.currency;
  if (!can(user.permissions, "settings", "edit")) return { ok: false, message: dict.common.forbidden };

  const code = (existing ?? input.code).trim().toUpperCase();
  const base = getBaseCurrencyCode();
  const errors: Record<string, string> = {};
  if (!/^[A-Z]{3}$/.test(code)) errors.code = t(v.required, { field: c.code });
  if (!input.name.trim()) errors.name = t(v.required, { field: c.name });
  const rate = code === base ? 1 : Number(input.rate);
  if (!Number.isFinite(rate) || rate <= 0 || rate > 1e9) errors.rate = v.invalidNumber;
  if (Object.keys(errors).length) return { ok: false, message: v.fixErrors, errors };

  if (!existing && (await prisma.currency.findUnique({ where: { code } }))) {
    return { ok: false, message: v.fixErrors, errors: { code: v.nameExists } };
  }
  const data = { name: input.name.trim(), symbol: input.symbol.trim() || null, rate, active: code === base ? true : input.active };
  await prisma.currency.upsert({ where: { code }, update: data, create: { code, ...data } });
  await audit(user, existing ? "edited" : "created", "settings", { ref: `currency ${code}` }, { rate });
  revalidatePath("/settings");
  revalidatePath("/documents", "layout");
  return { ok: true };
}

export async function deleteCurrency(code: string): Promise<Result> {
  const user = await getSessionUser();
  const dict = getDict();
  if (!can(user.permissions, "settings", "edit")) return { ok: false, message: dict.common.forbidden };
  if (code === getBaseCurrencyCode()) return { ok: false, message: dict.common.forbidden };
  const used = await prisma.document.count({ where: { currency: code } });
  if (used) return { ok: false, message: t(dict.currency.inUse, { n: used }) };
  await prisma.currency.delete({ where: { code } });
  await audit(user, "deleted", "settings", { ref: `currency ${code}` });
  revalidatePath("/settings");
  return { ok: true };
}
