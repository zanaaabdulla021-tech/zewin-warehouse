"use server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export async function unreadCount() {
  const user = await getSessionUser();
  return prisma.notification.count({ where: { userId: user.id, readAt: null } });
}

export async function listNotifications() {
  const user = await getSessionUser();
  const rows = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 25 });
  return rows.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, link: n.link, read: !!n.readAt, at: n.createdAt.toISOString() }));
}

export async function markRead(id: string) {
  const user = await getSessionUser();
  await prisma.notification.updateMany({ where: { id, userId: user.id, readAt: null }, data: { readAt: new Date() } });
}

export async function markAllRead() {
  const user = await getSessionUser();
  await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
}
