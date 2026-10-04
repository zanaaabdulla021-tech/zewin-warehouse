"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { postStockOperation } from "@/lib/stock";
import { MAX_IMPORT_ROWS, readWorkbook, validateImport, type ImportRow } from "@/lib/opening-import";
import { getDict } from "@/i18n/server";

export type PreviewRow = Omit<ImportRow, "warehouseId" | "productId">;
type Preview = { ok: true; rows: PreviewRow[] } | { ok: false; message: string };
type Commit = { ok: true; imported: number; references: string[] } | { ok: false; message: string };

async function load(fd: FormData, dict: ReturnType<typeof getDict>) {
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: dict.importer.fileError };
  let raw;
  try {
    raw = await readWorkbook(await file.arrayBuffer());
  } catch {
    return { error: dict.importer.fileError };
  }
  if (raw.length > MAX_IMPORT_ROWS) return { error: dict.importer.tooMany };
  return { rows: await validateImport(raw, fd.get("createMissing") === "1", dict) };
}

export async function previewImport(fd: FormData): Promise<Preview> {
  const user = await getSessionUser();
  const dict = getDict();
  if (!can(user.permissions, "stock", "edit")) return { ok: false, message: dict.common.forbidden };
  const res = await load(fd, dict);
  if ("error" in res) return { ok: false, message: res.error! };
  return { ok: true, rows: res.rows!.map(({ warehouseId, productId, ...r }) => r) };
}

/** Re-reads and re-validates the file (never trusts the preview), then posts valid rows. */
export async function commitImport(fd: FormData): Promise<Commit> {
  const user = await getSessionUser();
  const dict = getDict();
  if (!can(user.permissions, "stock", "edit")) return { ok: false, message: dict.common.forbidden };
  const res = await load(fd, dict);
  if ("error" in res) return { ok: false, message: res.error! };
  const valid = res.rows!.filter((r) => !r.errors.length);
  if (!valid.length) return { ok: false, message: dict.validation.noItems };

  try {
    const references = await prisma.$transaction(
      async (tx) => {
        // 1) create missing products (once per code)
        const units = await tx.unit.findMany();
        const unitOf = (u: string) => units.find((x) => x.symbol.toLowerCase() === u.toLowerCase() || x.name.toLowerCase() === u.toLowerCase())?.id ?? null;
        const created = new Map<string, string>();
        for (const r of valid.filter((x) => x.isNewProduct)) {
          if (created.has(r.productCode)) continue;
          const p = await tx.product.create({
            data: {
              code: r.productCode,
              name: r.productName,
              unitId: unitOf(r.unit),
              purchasePrice: new Prisma.Decimal(r.unitCost ?? 0),
              sellingPrice: new Prisma.Decimal(r.unitCost ?? 0),
              tracksBatch: !!r.batch,
              tracksExpiry: !!r.expiry,
            },
          });
          created.set(r.productCode, p.id);
        }
        // 2) one stock-in operation per warehouse
        const byWh = new Map<string, typeof valid>();
        for (const r of valid) byWh.set(r.warehouseId!, [...(byWh.get(r.warehouseId!) ?? []), r]);
        const refs: string[] = [];
        for (const [warehouseId, rows] of byWh) {
          const { reference } = await postStockOperation(
            tx,
            {
              type: "STOCK_IN",
              warehouseId,
              note: "Opening balance (Excel import)",
              lines: rows.map((r) => ({
                productId: r.productId ?? created.get(r.productCode)!,
                batchNumber: r.batch || null,
                expiryDate: r.expiry ? new Date(r.expiry) : null,
                quantity: r.quantity!,
                unitCost: r.unitCost,
              })),
            },
            user,
          );
          refs.push(reference);
        }
        return refs;
      },
      { timeout: 120000, maxWait: 10000 },
    );
    await audit(user, "created", "stock", { ref: references.join(", ") }, { import: true, rows: valid.length });
    revalidatePath("/", "layout");
    return { ok: true, imported: valid.length, references };
  } catch (e) {
    console.error("[import]", e);
    return { ok: false, message: dict.common.errorToast };
  }
}
