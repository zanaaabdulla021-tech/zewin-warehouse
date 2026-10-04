import { AppShell } from "@/components/layout/app-shell";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const [pending, unread] = await Promise.all([
    can(user.permissions, "accounting", "verify") ? prisma.document.count({ where: { status: "PENDING" } }) : 0,
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  return (
    <AppShell
      user={{ id: user.id, name: user.name, email: user.email, roleName: user.role.name }}
      permissions={user.permissions}
      pendingVerification={pending}
      unreadNotifications={unread}
    >
      {children}
    </AppShell>
  );
}
