import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { hashToken, SESSION_COOKIE_NAME } from "@wpi/auth";
import { Link, redirect } from "../../../i18n/navigation";
import { getAuditServices } from "../../../services/container";
import { TrendChart } from "../_components/trend-chart";
import { AuditList } from "../_components/audit-list";
import { ReminderBanner } from "../_components/reminder-banner";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const services = await getAuditServices();
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const user = cookieValue ? await services.auth.getSessionUser(hashToken(cookieValue)) : null;

  if (!user) {
    return redirect({ href: "/login", locale });
  }

  const t = await getTranslations({ locale, namespace: "dashboard" });
  const records = await services.store.listByUser(user.id);

  if (records.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center py-16">
        <div className="mx-auto max-w-md space-y-6 rounded-2xl border border-surface-200 bg-white p-8 text-center shadow-lg">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100">
            <svg
              className="h-7 w-7 text-brand-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-surface-900">{t("empty_title")}</h1>
          <p className="text-surface-700">{t("empty_body")}</p>
          <Link
            href="/#audit-form"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow-lg shadow-brand-600/25 transition-all hover:bg-brand-700 hover:shadow-xl"
          >
            {t("empty_cta")}
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    );
  }

  const latestCompleted = records.find((r) => r.report?.score?.presence_readiness != null);
  const latestScore = latestCompleted?.report?.score?.presence_readiness ?? null;

  const daysSinceLastAudit = Math.floor(
    (Date.now() - new Date((latestCompleted ?? records[0])!.created_at).getTime()) / DAY_MS,
  );

  return (
    <div className="space-y-8 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-surface-900">{t("title")}</h1>
        <Link
          href="/#audit-form"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-700 hover:shadow-md"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {t("empty_cta")}
        </Link>
      </div>

      {latestScore !== null ? (
        <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-surface-700">{t("latest_score_label")}</p>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-5xl font-bold text-surface-900">{latestScore}</span>
            <span className="text-lg text-surface-700">/ 100</span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-100">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${latestScore}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm">
        <TrendChart records={records} locale={locale} />
      </div>

      <div className="rounded-2xl border border-surface-200 bg-white shadow-sm">
        <AuditList records={records} locale={locale} />
      </div>

      <ReminderBanner days={daysSinceLastAudit} />
    </div>
  );
}
