import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "../../i18n/navigation";
import { AuditForm } from "./_components/audit-form";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("landing");

  return (
    <div className="space-y-12">
      <nav className="flex justify-end gap-4 text-sm" aria-label="Language">
        <Link href="/" locale="en" className={locale === "en" ? "font-semibold underline" : ""}>
          English
        </Link>
        <Link href="/" locale="ar" className={locale === "ar" ? "font-semibold underline" : ""}>
          العربية
        </Link>
      </nav>
      <section className="space-y-4 py-8 text-center">
        <h1 className="text-3xl font-semibold">{t("hero_title")}</h1>
        <p className="mx-auto max-w-2xl text-neutral-600">{t("hero_subtitle")}</p>
        <a
          href="#audit-form"
          className="inline-block rounded bg-neutral-900 px-6 py-3 font-medium text-white"
        >
          {t("cta")}
        </a>
      </section>
      <section id="audit-form">
        <AuditForm />
      </section>
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">{t("how_title")}</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          <li className="rounded border border-neutral-200 p-4">
            <h3 className="font-medium">{t("how_step1_title")}</h3>
            <p className="mt-2 text-sm text-neutral-600">{t("how_step1_body")}</p>
          </li>
          <li className="rounded border border-neutral-200 p-4">
            <h3 className="font-medium">{t("how_step2_title")}</h3>
            <p className="mt-2 text-sm text-neutral-600">{t("how_step2_body")}</p>
          </li>
          <li className="rounded border border-neutral-200 p-4">
            <h3 className="font-medium">{t("how_step3_title")}</h3>
            <p className="mt-2 text-sm text-neutral-600">{t("how_step3_body")}</p>
          </li>
        </ol>
        <p className="text-sm text-neutral-500">{t("no_signup")}</p>
      </section>
    </div>
  );
}
