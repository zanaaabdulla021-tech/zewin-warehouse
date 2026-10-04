import "server-only";
import nodemailer from "nodemailer";
import { prisma } from "./prisma";
import { getDict } from "@/i18n/server";
import { interpolate as t, LOCALES, type Locale } from "@/i18n/config";

/**
 * Notifications.
 * Every event is stored in-app (bell icon). Email and WhatsApp are sent too
 * when the server is configured for them and the user has the channel on.
 *
 *   Email    → SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *   WhatsApp → WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID
 *              (+ optional WHATSAPP_TEMPLATE / WHATSAPP_TEMPLATE_LANG for messages
 *               outside the 24-hour window — Meta requires an approved template there)
 */

export type DocEvent =
  | { type: "doc_submitted"; docId: string; number: string; actor: string; docType: string; total: string }
  | { type: "doc_verified"; docId: string; number: string; actor: string }
  | { type: "doc_rejected"; docId: string; number: string; actor: string; reason: string };

export function channelStatus() {
  return {
    email: !!process.env.SMTP_HOST,
    whatsapp: !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
  };
}

const appUrl = () => (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");

function render(ev: DocEvent, locale: Locale) {
  const d = getDict(locale);
  const n = d.notifications;
  switch (ev.type) {
    case "doc_submitted":
      return {
        title: t(n.submittedTitle, { n: ev.number }),
        body: t(n.submittedBody, { user: ev.actor, type: d.docType[ev.docType as keyof typeof d.docType] ?? ev.docType, total: ev.total }),
        link: `/accounting/${ev.docId}`,
      };
    case "doc_verified":
      return { title: t(n.verifiedTitle, { n: ev.number }), body: t(n.verifiedBody, { user: ev.actor }), link: `/documents/${ev.docId}` };
    case "doc_rejected":
      return { title: t(n.rejectedTitle, { n: ev.number }), body: t(n.rejectedBody, { user: ev.actor, reason: ev.reason }), link: `/documents/${ev.docId}` };
  }
}

/** Users who may verify documents (role has accounting.verify). */
export async function verifierIds(excludeUserId?: string) {
  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      id: excludeUserId ? { not: excludeUserId } : undefined,
      role: { OR: [{ key: "SUPER_ADMIN" }, { permissions: { some: { module: "accounting", action: "verify" } } }] },
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/**
 * Store the notifications, then deliver email / WhatsApp in the background.
 * Never throws — a delivery problem must not break the user's action.
 */
export async function notify(ev: DocEvent, userIds: string[]) {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (!ids.length) return;
  try {
    const users = await prisma.user.findMany({
      where: { id: { in: ids }, status: "ACTIVE" },
      select: { id: true, name: true, email: true, phone: true, locale: true, notifyEmail: true, notifyWhatsApp: true },
    });
    const rows = users.map((u) => {
      const locale = (LOCALES as readonly string[]).includes(u.locale) ? (u.locale as Locale) : "en";
      return { user: u, locale, msg: render(ev, locale) };
    });
    await prisma.notification.createMany({
      data: rows.map((r) => ({ userId: r.user.id, type: ev.type, title: r.msg.title, body: r.msg.body, link: r.msg.link })),
    });
    const ch = channelStatus();
    void Promise.allSettled(
      rows.flatMap((r) => [
        ch.email && r.user.notifyEmail ? sendEmail(r.user.email, r.msg, r.locale) : null,
        ch.whatsapp && r.user.notifyWhatsApp && r.user.phone ? sendWhatsApp(r.user.phone, r.msg, r.locale) : null,
      ]),
    ).then((res) => {
      for (const x of res) if (x.status === "rejected") console.error("[notify] delivery failed:", x.reason?.message ?? x.reason);
    });
  } catch (e) {
    console.error("[notify]", e);
  }
}

// ───────────────────────── channels ─────────────────────────

let transport: nodemailer.Transporter | null = null;
function mailer() {
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transport;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

async function sendEmail(to: string, msg: { title: string; body: string; link: string }, locale: Locale) {
  const dir = locale === "en" ? "ltr" : "rtl";
  const url = appUrl() + msg.link;
  const open = getDict(locale).notifications.open;
  await mailer().sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to,
    subject: `ZEWIN · ${msg.title}`,
    text: `${msg.title}\n\n${msg.body}\n\n${url}`,
    html: `<div dir="${dir}" style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#0f1a1f">
      <div style="font-weight:800;letter-spacing:.18em;font-size:18px">ZEWIN</div>
      <h2 style="margin:20px 0 8px;font-size:18px">${esc(msg.title)}</h2>
      <p style="margin:0 0 20px;color:#3b4a52;line-height:1.5">${esc(msg.body)}</p>
      <a href="${url}" style="display:inline-block;background:#0a8873;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px">${esc(open)}</a>
    </div>`,
  });
}

/** WhatsApp Cloud API (Meta). Phone numbers are normalised to digits with country code. */
async function sendWhatsApp(phone: string, msg: { title: string; body: string; link: string }, locale: Locale) {
  let to = phone.replace(/[^\d+]/g, "");
  if (to.startsWith("+")) to = to.slice(1);
  else if (to.startsWith("0")) to = "964" + to.slice(1); // local Iraqi number → +964
  const template = process.env.WHATSAPP_TEMPLATE;
  const payload = template
    ? {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: template,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG ?? (locale === "ar" ? "ar" : "en") },
          components: [{ type: "body", parameters: [{ type: "text", text: msg.title }, { type: "text", text: msg.body }] }],
        },
      }
    : { messaging_product: "whatsapp", to, type: "text", text: { body: `*${msg.title}*\n${msg.body}\n${appUrl()}${msg.link}` } };
  const res = await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
