export const CHECKS = ["documentNumber", "warehouse", "products", "quantities", "prices", "total"] as const;
export type CheckKey = (typeof CHECKS)[number];
export type Checklist = Record<CheckKey, boolean>;
export const emptyChecklist = (): Checklist => Object.fromEntries(CHECKS.map((c) => [c, false])) as Checklist;
