import { prisma } from "./prisma";
import type { SessionUser } from "./session";

export type AuditAction =
  | "created"
  | "edited"
  | "deleted"
  | "archived"
  | "verified"
  | "rejected"
  | "approved"
  | "exported";

export async function audit(
  user: Pick<SessionUser, "id" | "name">,
  action: AuditAction,
  module: string,
  record: { id?: string; ref?: string },
  details?: Record<string, unknown>,
) {
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      userName: user.name,
      action,
      module,
      recordId: record.id,
      recordRef: record.ref,
      details: details as object | undefined,
    },
  });
}
