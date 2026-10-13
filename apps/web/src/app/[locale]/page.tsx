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
    <div className="space-y-20">
      <nav className="flex justify-end gap-2 text-sm" aria-label="Language">
        <Link
          href="/"
          locale="en"
          className={`rounded-full px-3 py-1 transition-colors ${
            locale === "en"
              ? "bg-brand-100 font-semibold text-brand-700"
              : "text-surface-700 hover:bg-surface-100"
          }`}
        >
          English
        </Link>
        <Link
          href="/"
          locale="ar"
          className={`rounded-full px-3 py-1 transition-colors ${
            locale === "ar"
              ? "bg-brand-100 font-semibold text-brand-700"
              : "text-surface-700 hover:bg-surface-100"
          }`}
        >
          العربية
        </Link>
      </nav>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-brand-200/30 blur-3xl" />
          <div className="absolute -top-12 right-0 h-[400px] w-[400px] rounded-full bg-brand-100/40 blur-3xl" />
        </div>
        <div className="mx-auto max-w-3xl space-y-6 py-12 text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
            </span>
            AI-Powered Analysis
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-surface-950 sm:text-5xl lg:text-6xl">
            {t("hero_title")}
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-surface-700">
            {t("hero_subtitle")}
          </p>
          <div className="flex justify-center pt-2">
            <a
              href="#audit-form"
              className="group inline-flex items-center gap-2 rounded-xl bg-brand-600 px-8 py-3.5 font-semibold text-white shadow-lg shadow-brand-600/25 transition-all hover:bg-brand-700 hover:shadow-xl hover:shadow-brand-600/30 active:scale-[0.98]"
            >
              {t("cta")}
              <svg className="h-4 w-4 transition-transform group-hover:translate-y-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14" />
                <path d="m19 12-7 7-7-7" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      <section id="audit-form" className="scroll-mt-24 animate-slide-up">
        <AuditForm />
      </section>

      <section className="space-y-8 pb-12">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-surface-900 sm:text-3xl">
            {t("how_title")}
          </h2>
          <p className="mt-2 text-surface-700">{t("no_signup")}</p>
        </div>
        <ol className="grid gap-6 sm:grid-cols-3">
          <li className="group relative rounded-2xl border border-surface-200 bg-white p-6 shadow-sm transition-all hover:border-brand-200 hover:shadow-md">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-lg font-bold text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
              1
            </div>
            <h3 className="font-semibold text-surface-900">{t("how_step1_title")}</h3>
            <p className="mt-2 text-sm leading-relaxed text-surface-700">{t("how_step1_body")}</p>
          </li>
          <li className="group relative rounded-2xl border border-surface-200 bg-white p-6 shadow-sm transition-all hover:border-brand-200 hover:shadow-md">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-lg font-bold text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
              2
            </div>
            <h3 className="font-semibold text-surface-900">{t("how_step2_title")}</h3>
            <p className="mt-2 text-sm leading-relaxed text-surface-700">{t("how_step2_body")}</p>
          </li>
          <li className="group relative rounded-2xl border border-surface-200 bg-white p-6 shadow-sm transition-all hover:border-brand-200 hover:shadow-md">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-lg font-bold text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
              3
            </div>
            <h3 className="font-semibold text-surface-900">{t("how_step3_title")}</h3>
            <p className="mt-2 text-sm leading-relaxed text-surface-700">{t("how_step3_body")}</p>
          </li>
        </ol>
      </section>
    </div>
  );
}
