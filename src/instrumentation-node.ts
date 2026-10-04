import { prisma } from "./lib/prisma";
import { setBaseCurrency } from "./lib/utils";

// load the company base currency so server-side formatMoney uses it from the first request
try {
  const company = await prisma.company.findFirst({ select: { currency: true } });
  if (company?.currency) setBaseCurrency(company.currency);
} catch (e) {
  console.warn("[startup] could not load base currency:", (e as Error).message);
}
