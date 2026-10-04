import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getDict, getLocale } from "@/i18n/server";
import { isRtl } from "@/i18n/config";
import { I18nProvider } from "@/i18n/client";
import { ToastProvider } from "@/components/ui/toast";
import { BaseCurrency } from "@/components/layout/base-currency";
import { getBaseCurrencyCode } from "@/lib/utils";

export const metadata: Metadata = {
  title: { default: "Zewin Warehouse & Accounting", template: "%s · ZEWIN" },
  description: "Warehouse & Accounting Management System",
};
export const viewport: Viewport = { themeColor: "#0a8873", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = getLocale();
  const dict = getDict(locale);
  return (
    <html lang={locale === "ckb" ? "ckb" : locale} dir={isRtl(locale) ? "rtl" : "ltr"}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        <BaseCurrency code={getBaseCurrencyCode()} />
        <I18nProvider locale={locale} dict={dict}>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
