import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { StoredReportEnvelope } from "@wpi/audit-pipeline";
import { Link } from "../../../../i18n/navigation";
import { authorizeRecord } from "../../../../services/access";
import { getAuditServices } from "../../../../services/container";
import { describeAuditView } from "../../../../services/audit-view";
import { ReportView } from "./_components/report-view";
import { StatusPoller } from "./_components/status-poller";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata(): Promise<{
  robots: { index: boolean; follow: boolean };
  referrer: string;
}> {
  return { robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ s?: string }>;
}) {
  const { locale, id } = await params;
  const { s } = await searchParams;
  setRequestLocale(locale);

  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  const services = await getAuditServices();
  const outcome = await authorizeRecord(services.store, id, s);

  if (outcome.kind === "not_found" || outcome.kind === "deleted") {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "status" });

  if (outcome.kind === "expired") {
    return (
      <div className="space-y-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">{t("expired")}</h1>
        <Link href="/" className="underline">
          {t("start_new")}
        </Link>
      </div>
    );
  }

  const view = describeAuditView(outcome.record.status, outcome.record.failure_reason);

  if (view.kind === "failed") {
    const reason = view.reasonKey.startsWith("failure.")
      ? view.reasonKey.slice("failure.".length)
      : view.reasonKey;
    const tFailure = await getTranslations({ locale, namespace: "failure" });
    return (
      <div className="space-y-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">{t("failed_title")}</h1>
        <p className="text-neutral-600">{tFailure(reason)}</p>
        <Link href="/" className="underline">
          {t("start_new")}
        </Link>
      </div>
    );
  }

  const report = outcome.record.report;
  if (view.kind === "running" || report === null) {
    return <StatusPoller auditId={id} secret={s ?? ""} />;
  }

  return (
    <ReportView
      record={{ ...outcome.record, report }}
      locale={locale}
      secret={s ?? ""}
    />
  );
}
