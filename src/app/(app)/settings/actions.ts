"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { setBaseCurrency } from "@/lib/utils";
import { DOC_TYPES, type DocType } from "@/lib/documents";
import { getDict } from "@/i18n/server";
import { interpolate as t, LOCALES, type Locale } from "@/i18n/config";

type Result = { ok: true } | { ok: false; message: string; errors?: Record<string, string> };

export type CompanyInput = { name: string; legalName: string; taxNumber: string; phone: string; email: string; address: string; currency: string };

export async function saveCompany(input: CompanyInput): Promise<Result> {
  const user = await getSessionUser();
  const dict = getDict();
  const s = dict.settings;
  const v = dict.validation;
  if (!can(user.permissions, "settings", "edit")) return { ok: false, message: dict.common.forbidden };

  const errors: Record<string, string> = {};
  if (!input.name.trim()) errors.name = t(v.required, { field: s.companyName });
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) errors.email = v.invalidEmail;
  if (input.phone && !/^\+?[0-9\s-]{7,20}$/.test(input.phone.trim())) errors.phone = v.invalidPhone;
  if (!/^[A-Z]{3}$/.test(input.currency)) errors.currency = t(v.required, { field: s.currency });
  if (Object.keys(errors).length) return { ok: false, message: v.fixErrors, errors };

  const data = {
    name: input.name.trim(),
    legalName: input.legalName.trim() || null,
    taxNumber: input.taxNumber.trim() || null,
    phone: input.phone.trim() || null,
    email: input.email.trim() || null,
    address: input.address.trim() || null,
    currency: input.currency,
  };
  const existing = await prisma.company.findFirst({ select: { id: true } });
  if (existing) await prisma.company.update({ where: { id: existing.id }, data });
  else await prisma.company.create({ data });
  setBaseCurrency(data.currency);
  // the base currency is always worth exactly 1
  await prisma.currency.upsert({
    where: { code: data.currency },
    update: { rate: 1, active: true },
    create: { code: data.currency, name: data.currency, rate: 1 },
  });
  await audit(user, "edited", "settings", { ref: "company" });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveAppSettings(input: { defaultDocType: string; defaultTaxRate: string; expiryWarningDays: string }): Promise<Result> {
  const user = await getSessionUser();
  const dict = getDict();
  const v = dict.validation;
  if (!can(user.permissions, "settings", "edit")) return { ok: false, message: dict.common.forbidden };
  const errors: Record<string, string> = {};
  const tax = Number(input.defaultTaxRate);
  const days = Number(input.expiryWarningDays);
  if (!DOC_TYPES.includes(input.defaultDocType as DocType)) errors.defaultDocType = v.fixErrors;
  if (input.defaultTaxRate === "" || Number.isNaN(tax) || tax < 0 || tax > 100) errors.defaultTaxRate = v.invalidPercent;
  if (!Number.isInteger(days) || days < 1 || days > 730) errors.expiryWarningDays = v.invalidNumber;
  if (Object.keys(errors).length) return { ok: false, message: v.fixErrors, errors };

  const value = { defaultDocType: input.defaultDocType, defaultTaxRate: tax, expiryWarningDays: days };
  await prisma.setting.upsert({ where: { key: "app" }, update: { value }, create: { key: "app", value } });
  await audit(user, "edited", "settings", { ref: "documents & stock" }, value);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateProfile(input: { name: string; phone: string; locale: string }): Promise<Result> {
  const user = await getSessionUser();
  const dict = getDict();
  const v = dict.validation;
  const errors: Record<string, string> = {};
  if (!input.name.trim()) errors.name = t(v.required, { field: dict.employees.name });
  if (input.phone && !/^\+?[0-9\s-]{7,20}$/.test(input.phone.trim())) errors.phone = v.invalidPhone;
  if (Object.keys(errors).length) return { ok: false, message: v.fixErrors, errors };
  const locale = (LOCALES as readonly string[]).includes(input.locale) ? (input.locale as Locale) : "en";
  await prisma.user.update({ where: { id: user.id }, data: { name: input.name.trim(), phone: input.phone.trim() || null, locale } });
  cookies().set("zw_locale", locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  await audit(user, "edited", "employees", { id: user.id, ref: user.email }, { profile: true });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function changePassword(input: { current: string; next: string; confirm: string }): Promise<Result> {
  const user = await getSessionUser();
  const dict = getDict();
  const s = dict.settings;
  const errors: Record<string, string> = {};
  if (input.next.length < 8) errors.next = dict.validation.passwordShort;
  if (input.next !== input.confirm) errors.confirm = s.passwordMismatch;
  if (Object.keys(errors).length) return { ok: false, message: dict.validation.fixErrors, errors };
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!row?.passwordHash || !(await bcrypt.compare(input.current, row.passwordHash))) {
    return { ok: false, message: s.wrongPassword, errors: { current: s.wrongPassword } };
  }
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(input.next, 10) } });
  await audit(user, "edited", "employees", { id: user.id, ref: user.email }, { passwordChanged: true });
  return { ok: true };
}

export async function saveNotificationPrefs(input: { email: boolean; whatsapp: boolean }): Promise<Result> {
  const user = await getSessionUser();
  await prisma.user.update({ where: { id: user.id }, data: { notifyEmail: !!input.email, notifyWhatsApp: !!input.whatsapp } });
  return { ok: true };
}
