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
    <div className="min-h-screen bg-surface-50">
      <header className="sticky top-0 z-50 border-b border-surface-200/60 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
              <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-lg font-bold text-surface-900">WPI</span>
          </div>
          <nav className="flex items-center gap-1 text-sm" aria-label="Language">
            <Link
              href="/"
              locale="en"
              className={`rounded-full px-3 py-1.5 transition-all ${
                locale === "en"
                  ? "bg-brand-100 font-semibold text-brand-700 shadow-sm"
                  : "text-surface-700 hover:bg-surface-100 hover:text-surface-900"
              }`}
            >
              English
            </Link>
            <Link
              href="/"
              locale="ar"
              className={`rounded-full px-3 py-1.5 transition-all ${
                locale === "ar"
                  ? "bg-brand-100 font-semibold text-brand-700 shadow-sm"
                  : "text-surface-700 hover:bg-surface-100 hover:text-surface-900"
              }`}
            >
              العربية
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-24 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-brand-200/30 blur-3xl" />
            <div className="absolute -top-12 right-0 h-[400px] w-[400px] rounded-full bg-brand-100/40 blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgb(0_0_0_/_0.03)]_1px,transparent_0)] [background-size:24px_24px]" />
          </div>
          <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24">
            <div className="animate-fade-in space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-200/80 bg-brand-50/80 px-4 py-1.5 text-sm font-medium text-brand-700 shadow-sm backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
                </span>
                AI-Powered Analysis
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-surface-950 sm:text-5xl lg:text-6xl xl:text-7xl">
                {t("hero_title")}
              </h1>
              <p className="mx-auto max-w-2xl text-lg leading-relaxed text-surface-700 sm:text-xl">
                {t("hero_subtitle")}
              </p>
              <div className="flex flex-col items-center gap-4 pt-4 sm:flex-row sm:justify-center">
                <a
                  href="#audit-form"
                  className="group inline-flex items-center gap-2 rounded-xl bg-brand-600 px-8 py-3.5 font-semibold text-white shadow-lg shadow-brand-600/25 transition-all hover:bg-brand-700 hover:shadow-xl hover:shadow-brand-600/30 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
                >
                  {t("cta")}
                  <svg className="h-4 w-4 transition-transform group-hover:translate-y-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14" />
                    <path d="m19 12-7 7-7-7" />
                  </svg>
                </a>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 pt-8 text-sm text-surface-700">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  <span>No signup required</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  <span>Free audit report</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  <span>Arabic & English</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="audit-form" className="scroll-mt-20 animate-slide-up">
          <AuditForm />
        </section>

        <section className="space-y-12 pb-20 pt-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-surface-900 sm:text-3xl">
              {t("how_title")}
            </h2>
            <p className="mt-3 text-surface-700">{t("no_signup")}</p>
          </div>
          <ol className="mx-auto grid max-w-5xl gap-6 px-4 sm:grid-cols-3 sm:px-6">
            <li className="group relative rounded-2xl border border-surface-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-600">Step 1</div>
              <h3 className="text-lg font-semibold text-surface-900">{t("how_step1_title")}</h3>
              <p className="mt-2 text-sm leading-relaxed text-surface-700">{t("how_step1_body")}</p>
            </li>
            <li className="group relative rounded-2xl border border-surface-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.376 3.622a1 1 0 0 1 1.002 1.002L16.5 8.5a2 2 0 0 1-2 2H10a2 2 0 0 0-2 2v1.173" />
                  <path d="M4 16v-1.364a1 1 0 0 1 .44-.832l6-4a1 1 0 0 1 1.12 0l6 4a1 1 0 0 1 .44.832V16" />
                </svg>
              </div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-600">Step 2</div>
              <h3 className="text-lg font-semibold text-surface-900">{t("how_step2_title")}</h3>
              <p className="mt-2 text-sm leading-relaxed text-surface-700">{t("how_step2_body")}</p>
            </li>
            <li className="group relative rounded-2xl border border-surface-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                  <path d="M16 13H8" />
                  <path d="M16 17H8" />
                  <path d="M10 9H8" />
                </svg>
              </div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-600">Step 3</div>
              <h3 className="text-lg font-semibold text-surface-900">{t("how_step3_title")}</h3>
              <p className="mt-2 text-sm leading-relaxed text-surface-700">{t("how_step3_body")}</p>
            </li>
          </ol>
        </section>
      </main>

      <footer className="border-t border-surface-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 text-center text-sm text-surface-700 sm:px-6">
          <p>Web Presence Intelligence — AI-powered website auditing for Jordan & the GCC</p>
        </div>
      </footer>
    </div>
  );
}
