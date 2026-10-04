"use client";

import { setBaseCurrency } from "@/lib/utils";

/** Sets the base currency for client-side formatMoney before children render. */
export function BaseCurrency({ code }: { code: string }) {
  setBaseCurrency(code);
  return null;
}
