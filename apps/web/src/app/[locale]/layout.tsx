import { IBM_Plex_Sans_Arabic, Inter } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Link } from "../../i18n/navigation";
import { routing } from "../../i18n/routing";
import "../../app/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "600"],
  variable: "--font-plex-arabic",
});

export function generateStaticParams(): Array<{ locale: string }> {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("brand") };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const dir = locale === "ar" ? "rtl" : "ltr";
  const t = await getTranslations({ locale, namespace: "nav" });

  return (
    <html lang={locale} dir={dir} className={`${inter.variable} ${plexArabic.variable}`}>
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        <NextIntlClientProvider>
          <header className="border-b border-neutral-200">
            <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
              <Link href="/" className="font-semibold">
                {t("brand")}
              </Link>
              <div className="flex gap-4 text-sm">
                <Link href="/methodology">{t("methodology")}</Link>
                <Link href="/privacy">{t("privacy")}</Link>
                <Link href="/terms">{t("terms")}</Link>
              </div>
            </nav>
          </header>
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
