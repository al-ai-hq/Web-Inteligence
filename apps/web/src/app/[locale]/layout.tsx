import { IBM_Plex_Sans_Arabic, Inter } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { hashToken, SESSION_COOKIE_NAME } from "@wpi/auth";
import { Link } from "../../i18n/navigation";
import { routing } from "../../i18n/routing";
import { getAuditServices } from "../../services/container";
import { SignOutButton } from "./_components/sign-out-button";
import { MobileNav } from "./_components/mobile-nav";
import "../../app/globals.css";

export const dynamic = "force-dynamic";

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

  const services = await getAuditServices();
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const user = cookieValue
    ? await services.auth.getSessionUser(hashToken(cookieValue))
    : null;

  const dir = locale === "ar" ? "rtl" : "ltr";
  const t = await getTranslations({ locale, namespace: "nav" });

  return (
    <html lang={locale} dir={dir} className={`${inter.variable} ${plexArabic.variable}`}>
      <body className="min-h-screen bg-surface-50 text-surface-900 antialiased">
        <NextIntlClientProvider>
          <header className="sticky top-0 z-50 border-b border-surface-200/60 bg-white/80 backdrop-blur-lg">
            <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
              <Link href="/" className="flex items-center gap-2 font-bold text-surface-900 transition-colors hover:text-brand-600">
                <svg className="h-7 w-7 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                  <path d="M2 12h20" />
                </svg>
                {t("brand")}
              </Link>
              <div className="hidden items-center gap-1 text-sm md:flex">
                <Link href="/methodology" className="rounded-lg px-3 py-2 text-surface-700 transition-colors hover:bg-surface-100 hover:text-surface-900">
                  {t("methodology")}
                </Link>
                <Link href="/privacy" className="rounded-lg px-3 py-2 text-surface-700 transition-colors hover:bg-surface-100 hover:text-surface-900">
                  {t("privacy")}
                </Link>
                <Link href="/terms" className="rounded-lg px-3 py-2 text-surface-700 transition-colors hover:bg-surface-100 hover:text-surface-900">
                  {t("terms")}
                </Link>
                <div className="mx-2 h-4 w-px bg-surface-200" />
                {user ? (
                  <>
                    <Link href="/dashboard" className="rounded-lg px-3 py-2 text-surface-700 transition-colors hover:bg-surface-100 hover:text-surface-900">
                      {t("dashboard")}
                    </Link>
                    <span className="max-w-[10rem] truncate px-2 text-sm text-surface-700" title={user.email}>
                      {user.email}
                    </span>
                    <SignOutButton />
                  </>
                ) : (
                  <>
                    <Link href="/login" className="rounded-lg px-3 py-2 text-surface-700 transition-colors hover:bg-surface-100 hover:text-surface-900">
                      {t("sign_in")}
                    </Link>
                    <Link href="/signup" className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white shadow-sm transition-all hover:bg-brand-700 hover:shadow-md">
                      {t("sign_up")}
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </header>
          <MobileNav user={user} />
          <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
