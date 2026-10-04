/* Seed: roles + permissions, demo users, warehouses, products, stock, documents, audit log.
 * Run: npm run db:seed   (safe to re-run — it clears demo data first)
 */
import { PrismaClient, type RoleKey, type Product } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ROLE_MATRIX } from "../src/lib/permissions";

const prisma = new PrismaClient();
const days = (n: number) => new Date(Date.now() + n * 86400000);

async function main() {
  console.log("Clearing…");
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.verification.deleteMany(),
    prisma.stockMovement.deleteMany(),
    prisma.documentItem.deleteMany(),
    prisma.document.deleteMany(),
    prisma.stockLevel.deleteMany(),
    prisma.batch.deleteMany(),
    prisma.product.deleteMany(),
    prisma.category.deleteMany(),
    prisma.unit.deleteMany(),
    prisma.supplier.deleteMany(),
    prisma.warehouseEmployee.deleteMany(),
    prisma.warehouse.deleteMany(),
    prisma.user.deleteMany(),
    prisma.rolePermission.deleteMany(),
    prisma.role.deleteMany(),
    prisma.company.deleteMany(),
    prisma.currency.deleteMany(),
    prisma.notification.deleteMany(),
  ]);

  // ── Roles & permissions
  const roleNames: Record<RoleKey, string> = {
    SUPER_ADMIN: "Super Admin",
    ADMIN: "Admin",
    ACCOUNTING: "Accounting",
    WAREHOUSE_MANAGER: "Warehouse Manager",
    WAREHOUSE_EMPLOYEE: "Warehouse Employee",
  };
  const roles = {} as Record<RoleKey, string>;
  for (const key of Object.keys(roleNames) as RoleKey[]) {
    const role = await prisma.role.create({
      data: {
        key,
        name: roleNames[key],
        permissions: {
          create: Object.entries(ROLE_MATRIX[key]).flatMap(([module, actions]) =>
            (actions ?? []).map((action) => ({ module, action })),
          ),
        },
      },
    });
    roles[key] = role.id;
  }

  await prisma.company.create({
    data: { name: "Zewin Group", currency: "USD", address: "Erbil, Kurdistan Region", phone: "+964 750 000 0000" },
  });

  // ── Currencies (base = USD, rates = USD per 1 unit)
  await prisma.currency.createMany({
    data: [
      { code: "USD", name: "US Dollar", symbol: "$", rate: 1 },
      { code: "IQD", name: "Iraqi Dinar", symbol: "IQD", rate: 0.000763 },
      { code: "EUR", name: "Euro", symbol: "€", rate: 1.08 },
    ],
  });

  // ── Users
  // every demo account uses the password "zewin123" — change it after first login
  const passwordHash = await bcrypt.hash("zewin123", 10);
  const mk = (name: string, email: string, role: RoleKey) =>
    prisma.user.create({ data: { name, email, passwordHash, roleId: roles[role] } });
  const zana = await mk("Zana Abdullah", "zana@zewin.app", "SUPER_ADMIN");
  const ahmed = await mk("Ahmed Karim", "ahmed@zewin.app", "ADMIN");
  const shirin = await mk("Shirin Omar", "shirin@zewin.app", "ACCOUNTING");
  const karwan = await mk("Karwan Aziz", "karwan@zewin.app", "WAREHOUSE_MANAGER");
  const dilan = await mk("Dilan Hassan", "dilan@zewin.app", "WAREHOUSE_EMPLOYEE");
  const rebin = await mk("Rebin Salar", "rebin@zewin.app", "WAREHOUSE_MANAGER");

  // ── Warehouses
  const wh = async (code: string, name: string, type: "MAIN" | "BRANCH" | "COLD_STORAGE" | "TRANSIT", city: string, managerId: string | null, capacity: number, status: "ACTIVE" | "INACTIVE" = "ACTIVE") =>
    prisma.warehouse.create({
      data: { code, name, type, city, managerId, capacity, status, address: `${city} industrial zone`, phone: "+964 750 123 4567" },
    });
  const w1 = await wh("WH-001", "Erbil Central Warehouse", "MAIN", "Erbil", karwan.id, 2400);
  const w2 = await wh("WH-002", "Sulaymaniyah Branch", "BRANCH", "Sulaymaniyah", rebin.id, 900);
  const w3 = await wh("WH-003", "Cold Chain Storage", "COLD_STORAGE", "Erbil", karwan.id, 300);
  await wh("WH-004", "Duhok Transit Point", "TRANSIT", "Duhok", null, 150, "INACTIVE");

  await prisma.warehouseEmployee.createMany({
    data: [
      { warehouseId: w1.id, userId: karwan.id, position: "Warehouse Manager" },
      { warehouseId: w1.id, userId: dilan.id, position: "Storekeeper" },
      { warehouseId: w2.id, userId: rebin.id, position: "Branch Manager" },
      { warehouseId: w3.id, userId: dilan.id, position: "Cold chain operator" },
    ],
  });

  // ── Catalog
  const [tablets, syrups, injections, supplies] = await Promise.all(
    ["Tablets & Capsules", "Syrups", "Injections", "Medical Supplies"].map((name) => prisma.category.create({ data: { name } })),
  );
  const [box, bottle, vial, pcs] = await Promise.all(
    [
      ["Box", "box"],
      ["Bottle", "btl"],
      ["Vial", "vial"],
      ["Piece", "pcs"],
    ].map(([name, symbol]) => prisma.unit.create({ data: { name, symbol } })),
  );

  const productsSpec = [
    ["PR-001", "Paracetamol 500mg", tablets, box, 1.2, 2.0, 200],
    ["PR-002", "Paracetamol 1g", tablets, box, 1.9, 3.0, 120],
    ["PR-003", "Ibuprofen 400mg", tablets, box, 1.6, 2.6, 150],
    ["PR-004", "Amoxicillin 500mg", tablets, box, 3.4, 5.5, 100],
    ["PR-005", "Omeprazole 20mg", tablets, box, 2.1, 3.6, 80],
    ["PR-006", "Cough Syrup 120ml", syrups, bottle, 2.8, 4.5, 60],
    ["PR-007", "Insulin Glargine", injections, vial, 18.5, 26.0, 40],
    ["PR-008", "Ceftriaxone 1g", injections, vial, 2.4, 4.0, 90],
    ["PR-009", "Surgical Gloves (M)", supplies, box, 4.5, 7.0, 50],
    ["PR-010", "Syringe 5ml", supplies, pcs, 0.08, 0.15, 1000],
  ] as const;

  const products: Product[] = [];
  for (const [code, name, cat, unit, buy, sell, min] of productsSpec) {
    products.push(
      await prisma.product.create({
        data: { code, name, barcode: `62640${code.slice(3)}00001`, categoryId: cat.id, unitId: unit.id, purchasePrice: buy, sellingPrice: sell, minQuantity: min, taxRate: 0 },
      }),
    );
  }

  // ── Stock (some intentionally below minimum / expiring soon)
  const stockSpec: [number, string, string, number, number][] = [
    // productIdx, warehouseId, batch, qty, expiryInDays
    [0, w1.id, "PCM-2409", 860, 420],
    [0, w2.id, "PCM-2409", 140, 420],
    [1, w1.id, "PCM1-2411", 95, 300],
    [2, w1.id, "IBU-2408", 410, 25],
    [3, w1.id, "AMX-2410", 64, 200],
    [4, w2.id, "OME-2412", 230, 510],
    [5, w2.id, "CSY-2407", 38, 45],
    [6, w3.id, "INS-2409", 120, 160],
    [7, w3.id, "CEF-2410", 310, 260],
    [8, w1.id, "GLV-2405", 180, 900],
    [9, w1.id, "SYR-2406", 4200, 1100],
  ];
  for (const [pi, warehouseId, number, qty, exp] of stockSpec) {
    const p = products[pi]!;
    const batch = await prisma.batch.upsert({
      where: { productId_number: { productId: p.id, number } },
      update: {},
      create: { productId: p.id, number, expiryDate: days(exp) },
    });
    await prisma.stockLevel.create({ data: { warehouseId, productId: p.id, batchId: batch.id, quantity: qty } });
    await prisma.stockMovement.create({
      data: {
        type: "STOCK_IN",
        reference: "SI-000001",
        note: "Opening balance",
        createdById: karwan.id,
        createdByName: karwan.name,
        warehouseId,
        productId: p.id,
        batchId: batch.id,
        quantity: qty,
        unitCost: p.purchasePrice,
        createdAt: new Date(Date.now() - 10 * 86400000),
      },
    });
  }

  // ── Suppliers
  const s1 = await prisma.supplier.create({ data: { code: "SUP-001", name: "Kurdistan Pharma Distribution", city: "Erbil", phone: "+964 750 222 1111" } });
  const s2 = await prisma.supplier.create({ data: { code: "SUP-002", name: "MedLine Iraq", city: "Baghdad", phone: "+964 770 333 2222" } });

  // ── Documents
  const docSpec = [
    [125, "PURCHASE", "PENDING", w1.id, s1.id, -1, [[0, 300, 1.2], [2, 200, 1.6]]],
    [126, "PURCHASE", "PENDING", w3.id, s2.id, 0, [[6, 40, 18.5]]],
    [127, "TRANSFER", "PROCESSING", w1.id, null, 0, [[0, 100, 1.2]]],
    [128, "RETURN", "REJECTED", w2.id, s1.id, -3, [[5, 12, 2.8]]],
    [124, "PURCHASE", "VERIFIED", w1.id, s1.id, -4, [[9, 2000, 0.08], [8, 80, 4.5]]],
    [129, "STOCK_IN", "DRAFT", w2.id, null, 0, [[4, 60, 2.1]]],
    [123, "PURCHASE", "VERIFIED", w2.id, s2.id, -8, [[4, 150, 2.1]]],
  ] as const;
  for (const [n, type, status, warehouseId, supplierId, d, items] of docSpec) {
    const lines = items.map(([pi, qty, price], i) => ({
      productId: products[pi]!.id,
      quantity: qty,
      unitPrice: price,
      lineTotal: +(qty * price).toFixed(2),
      position: i,
    }));
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const created = await prisma.document.create({
      data: {
        number: `DOC-${String(n).padStart(6, "0")}`,
        type,
        status,
        date: days(d),
        warehouseId,
        toWarehouseId: type === "TRANSFER" ? w2.id : null,
        supplierId,
        subtotal,
        grandTotal: subtotal,
        currency: "USD",
        exchangeRate: 1,
        grandTotalBase: subtotal,
        createdById: type === "TRANSFER" ? karwan.id : dilan.id,
        verifiedById: status === "VERIFIED" || status === "REJECTED" ? shirin.id : null,
        verifiedAt: status === "VERIFIED" || status === "REJECTED" ? days(d + 1) : null,
        submittedAt: status === "DRAFT" ? null : days(d),
        items: { create: lines },
      },
    });
    if (status === "VERIFIED" || status === "REJECTED") {
      await prisma.verification.create({
        data: {
          documentId: created.id,
          userId: shirin.id,
          result: status,
          checklist: { documentNumber: true, warehouse: true, products: true, quantities: true, prices: status === "VERIFIED", total: status === "VERIFIED" },
          reason: status === "REJECTED" ? "Unit price on line 1 does not match the supplier invoice." : null,
          createdAt: days(d + 1),
        },
      });
    }
  }

  // ── Audit log
  const log = (u: { id: string; name: string }, action: string, module: string, ref: string, minsAgo: number) =>
    prisma.auditLog.create({
      data: { userId: u.id, userName: u.name, action, module, recordRef: ref, createdAt: new Date(Date.now() - minsAgo * 60000) },
    });
  await log(zana, "created", "warehouses", "WH-001", 60 * 24 * 9);
  await log(ahmed, "edited", "products", "PR-002", 60 * 30);
  await log(shirin, "verified", "documents", "DOC-000124", 60 * 5);
  await log(ahmed, "rejected", "documents", "DOC-000128", 60 * 3);
  await log(dilan, "created", "documents", "DOC-000126", 45);
  await log(karwan, "created", "documents", "DOC-000127", 20);

  console.log("✓ Seed complete — sign in with any demo account (password: zewin123).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
