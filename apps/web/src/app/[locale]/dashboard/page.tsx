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

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const services = await getAuditServices();
  const cookieStore = await cookies();
  const user = await services.auth.getSessionUser(
    hashToken(cookieStore.get(SESSION_COOKIE_NAME)?.value ?? ""),
  );

  if (!user) {
    return redirect({ href: "/login", locale });
  }

  const t = await getTranslations({ locale, namespace: "dashboard" });
  const records = await services.store.listByUser(user.id);

  if (records.length === 0) {
    return (
      <div className="space-y-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">{t("empty_title")}</h1>
        <p className="text-neutral-600">{t("empty_body")}</p>
        <Link
          href="/#audit-form"
          className="inline-block rounded-md bg-blue-600 px-4 py-2 font-medium text-white"
        >
          {t("empty_cta")}
        </Link>
      </div>
    );
  }

  const latestScore =
    records[0]?.report?.score?.presence_readiness ?? null;

  const daysSinceLastAudit = Math.floor(
    (Date.now() - new Date(records[0]!.created_at).getTime()) / DAY_MS,
  );

  return (
    <div className="space-y-8 py-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      {latestScore !== null ? (
        <p className="text-lg">
          {t("score", { score: latestScore })}
        </p>
      ) : null}
      <TrendChart records={records} locale={locale} />
      <AuditList records={records} locale={locale} />
      <ReminderBanner days={daysSinceLastAudit} />
    </div>
  );
}
