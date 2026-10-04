import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Base (company) currency used when no currency is passed. Set once on the server
 * at start-up / when the company changes it, and on the client by <BaseCurrency>.
 */
// kept on globalThis so every server bundle (instrumentation, pages, actions) sees the same value
const g = globalThis as unknown as { __zwBaseCurrency?: string };
export function setBaseCurrency(code: string) {
  if (/^[A-Z]{3}$/.test(code)) g.__zwBaseCurrency = code;
}
export function getBaseCurrencyCode() {
  return g.__zwBaseCurrency ?? "USD";
}

const moneyFormats = new Map<string, Intl.NumberFormat>();
export function formatMoney(value: number | string | { toString(): string }, currency = getBaseCurrencyCode()) {
  const n = typeof value === "number" ? value : Number(value.toString());
  let f = moneyFormats.get(currency);
  if (!f) {
    try {
      f = new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: currency === "IQD" ? 0 : 2, maximumFractionDigits: 2 });
    } catch {
      f = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
    }
    moneyFormats.set(currency, f);
  }
  return f.format(n);
}

export function formatNumber(value: number | string | { toString(): string }) {
  const n = typeof value === "number" ? value : Number(value.toString());
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatDate(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatTime(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Serialise Prisma Decimal/Date for client components. */
export function toPlain<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}
