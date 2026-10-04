/**
 * Role-based permission matrix.
 * Single source of truth: used by the seed (writes RolePermission rows)
 * and by the UI/server (hides modules and actions a role can't use).
 */

export const MODULES = [
  "dashboard",
  "warehouses",
  "products",
  "stock",
  "documents",
  "accounting",
  "suppliers",
  "reports",
  "employees",
  "settings",
] as const;
export type Module = (typeof MODULES)[number];

export const ACTIONS = ["view", "create", "edit", "delete", "verify", "approve", "export"] as const;
export type Action = (typeof ACTIONS)[number];

export type RoleKey =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "ACCOUNTING"
  | "WAREHOUSE_MANAGER"
  | "WAREHOUSE_EMPLOYEE";

type Matrix = Partial<Record<Module, Action[]>>;

const ALL: Action[] = [...ACTIONS];
const CRUD: Action[] = ["view", "create", "edit", "delete", "export"];

export const ROLE_MATRIX: Record<RoleKey, Matrix> = {
  SUPER_ADMIN: Object.fromEntries(MODULES.map((m) => [m, ALL])) as Matrix,
  ADMIN: {
    dashboard: ["view"],
    warehouses: CRUD,
    products: CRUD,
    stock: ["view", "create", "edit", "approve", "export"],
    documents: [...CRUD, "approve"],
    accounting: ["view", "export"],
    suppliers: CRUD,
    reports: ["view", "export"],
    employees: CRUD,
    settings: ["view", "edit"],
  },
  ACCOUNTING: {
    dashboard: ["view"],
    warehouses: ["view"],
    products: ["view"],
    stock: ["view"],
    documents: ["view", "export"],
    accounting: ["view", "verify", "approve", "export"],
    suppliers: ["view", "export"],
    reports: ["view", "export"],
  },
  WAREHOUSE_MANAGER: {
    dashboard: ["view"],
    warehouses: ["view", "edit"],
    products: ["view", "create", "edit"],
    stock: ["view", "create", "edit", "approve", "export"],
    documents: ["view", "create", "edit", "approve", "export"],
    suppliers: ["view"],
    reports: ["view", "export"],
    employees: ["view"],
  },
  WAREHOUSE_EMPLOYEE: {
    dashboard: ["view"],
    warehouses: ["view"],
    products: ["view"],
    stock: ["view", "create"],
    documents: ["view", "create"],
  },
};

export type PermissionSet = Matrix;

export function can(perms: PermissionSet, module: Module, action: Action = "view") {
  return perms[module]?.includes(action) ?? false;
}

/** Throw on the server when a mutation isn't allowed. */
export function assertCan(perms: PermissionSet, module: Module, action: Action) {
  if (!can(perms, module, action)) {
    throw new PermissionError();
  }
}

export class PermissionError extends Error {
  constructor() {
    super("forbidden");
    this.name = "PermissionError";
  }
}
