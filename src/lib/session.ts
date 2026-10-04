import { cache } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { prisma } from "./prisma";
import { ROLE_MATRIX, type PermissionSet, type RoleKey, type Module, type Action } from "./permissions";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: { key: RoleKey; name: string };
  permissions: PermissionSet;
};

/**
 * Current user with role permissions loaded from the database
 * (falls back to ROLE_MATRIX if a role has no rows yet).
 * Redirects to /login when there is no valid session.
 */
export const getSessionUser = cache(async (): Promise<SessionUser> => {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  if (!id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id },
    include: { role: { include: { permissions: true } } },
  });
  if (!user || user.status !== "ACTIVE") redirect("/login");

  const permissions: PermissionSet = {};
  if (user.role.permissions.length) {
    for (const p of user.role.permissions) {
      (permissions[p.module as Module] ??= []).push(p.action as Action);
    }
  } else {
    Object.assign(permissions, ROLE_MATRIX[user.role.key as RoleKey]);
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: { key: user.role.key as RoleKey, name: user.role.name },
    permissions,
  };
});
