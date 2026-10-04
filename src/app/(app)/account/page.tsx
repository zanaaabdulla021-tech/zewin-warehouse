import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { getDict } from "@/i18n/server";
import { PageHeader } from "@/components/ui/card";
import { channelStatus } from "@/lib/notify";
import { NotificationPrefsForm, PasswordForm, ProfileForm } from "./account-forms";

export const metadata = { title: "My account" };

/** Available to every signed-in user, whatever their role. */
export default async function AccountPage() {
  const user = await getSessionUser();
  const dict = getDict();
  const me = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true, phone: true, locale: true, email: true, notifyEmail: true, notifyWhatsApp: true } });
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title={dict.settings.tabAccount} description={me.email} />
      <ProfileForm initial={{ name: me.name, phone: me.phone ?? "", locale: me.locale }} email={me.email} role={user.role.name} />
      <NotificationPrefsForm
        initial={{ email: me.notifyEmail, whatsapp: me.notifyWhatsApp }}
        email={me.email}
        phone={me.phone}
        channels={channelStatus()}
      />
      <PasswordForm />
    </div>
  );
}
