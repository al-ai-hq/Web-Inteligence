import { getTranslations } from "next-intl/server";
import type { AuditRecord, StoredFinding, StoredReportEnvelope } from "@wpi/audit-pipeline";
import { Link } from "../../../../../i18n/navigation";
import { DeleteButton } from "./delete-button";
import { MethodologyDisclosure } from "./methodology-disclosure";
import { ScoreCard } from "./score-card";

const SECTIONS = ["technical", "keywords", "content", "performance"] as const;

const SUMMARY_LABEL_KEYS: Record<string, string> = {
  "report.summary.technical": "summary_technical",
  "report.summary.keywords": "summary_keywords",
  "report.summary.content": "summary_content",
};

function firstString(data: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}

function findingTitle(finding: StoredFinding): string {
  return (
    firstString(finding.data, ["title", "summary"]) ??
    firstString(finding.data, ["recommendation", "description", "detail"]) ??
    finding.id
  );
}

function findingDetail(finding: StoredFinding): string | undefined {
  return firstString(finding.data, ["recommendation", "description", "detail"]);
}

type AuditRecordWithReport = Omit<AuditRecord, "secret_hash"> & { report: StoredReportEnvelope };

function severityClasses(severity: string): string {
  switch (severity) {
    case "high":
      return "bg-red-100 text-red-700";
    case "medium":
      return "bg-amber-100 text-amber-700";
    case "low":
      return "bg-blue-100 text-blue-700";
    default:
      return "bg-surface-100 text-surface-700";
  }
}

function stateClasses(state: string): string {
  switch (state) {
    case "pass":
      return "bg-emerald-100 text-emerald-700";
    case "fail":
      return "bg-red-100 text-red-700";
    case "warn":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-surface-100 text-surface-700";
  }
}

export async function ReportView({
  record,
  locale,
  secret,
}: {
  record: AuditRecordWithReport;
  locale: string;
  secret: string;
}) {
  const t = await getTranslations({ locale, namespace: "report" });
  const tUnavailable = await getTranslations({ locale, namespace: "unavailable" });
  const tLimitation = await getTranslations({ locale, namespace: "limitation" });
  const tStatus = await getTranslations({ locale, namespace: "status" });
  const envelope = record.report;

  return (
    <div className="space-y-10 py-8">
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-surface-900">{t("sections_title")}</h1>
          <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-medium text-brand-700">
            {tStatus(`stage_${record.status}`)}
          </span>
        </div>
        {envelope.report.content.sample_disclosure.sampled ? (
          <p className="text-sm text-surface-700">
            {t("sample_disclosure", {
              pages: envelope.report.content.sample_disclosure.pages_checked,
            })}
          </p>
        ) : null}
      </header>

      {envelope.score !== null ? <ScoreCard score={envelope.score} locale={locale} /> : null}

      {envelope.report.content.summary_bullets.length > 0 ? (
        <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-surface-800">{t("summary_title")}</h2>
          <ul className="space-y-2">
            {envelope.report.content.summary_bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2 text-surface-700">
                <svg
                  className="mt-0.5 h-4 w-4 shrink-0 text-brand-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {t(SUMMARY_LABEL_KEYS[bullet] ?? bullet)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {SECTIONS.map((section) => {
        const findings = envelope.findings.filter((finding) => finding.section === section);
        if (findings.length === 0) {
          return null;
        }
        return (
          <section key={section} className="space-y-4">
            <h2 className="text-xl font-bold text-surface-900">{t(`section_${section}`)}</h2>
            <ul className="space-y-3">
              {findings.map((finding) => (
                <li
                  key={finding.id}
                  className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${severityClasses(finding.severity)}`}
                    >
                      {t(`severity_${finding.severity}`)}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${stateClasses(finding.state)}`}
                    >
                      {t(`state_${finding.state}`)}
                    </span>
                    <span className="rounded-full bg-surface-100 px-2.5 py-0.5 text-xs font-medium text-surface-700">
                      {t(`confidence_${finding.confidence}`)}
                    </span>
                  </div>
                  <p className="mt-3 font-semibold text-surface-900">{findingTitle(finding)}</p>
                  {findingDetail(finding) !== undefined ? (
                    <p className="mt-1.5 text-sm leading-relaxed text-surface-700">
                      {findingDetail(finding)}
                    </p>
                  ) : null}
                  {finding.evidence_ids.length > 0 ? (
                    <div className="mt-3 space-y-1.5">
                      <p className="text-xs font-medium text-surface-700">
                        {finding.evidence_ids.length} {t("evidence_items")}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {finding.evidence_ids.map((evidenceId) => (
                          <code
                            key={evidenceId}
                            className="rounded-lg bg-surface-100 px-2 py-0.5 text-xs text-surface-700"
                            title={evidenceId}
                          >
                            {evidenceId.slice(0, 8)}
                          </code>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {envelope.action_board.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-surface-900">{t("action_board_title")}</h2>
          <ol className="space-y-3">
            {envelope.action_board.map((item, index) => (
              <li
                key={item.source_finding_id}
                className="flex gap-4 rounded-2xl border border-surface-200 bg-white p-5 shadow-sm"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-sm font-bold text-brand-600">
                  {index + 1}
                </span>
                <div>
                  <p className="font-semibold text-surface-900">{item.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-surface-700">{item.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {envelope.unavailable.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-800">{t("unavailable_title")}</h2>
          <ul className="mt-3 space-y-1.5 text-sm text-amber-700">
            {envelope.unavailable.map((block) => (
              <li key={`${block.section}:${block.reason_key}`} className="flex items-start gap-2">
                <svg
                  className="mt-0.5 h-4 w-4 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {tUnavailable(block.reason_key.replace(/^unavailable\./, ""))}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {envelope.report.content.limitations_keys.length > 0 ? (
        <section className="rounded-2xl border border-surface-200 bg-surface-50 p-6">
          <h2 className="text-lg font-semibold text-surface-800">{t("limitations_title")}</h2>
          <ul className="mt-3 space-y-1.5 text-sm text-surface-700">
            {envelope.report.content.limitations_keys.map((key) => (
              <li key={key} className="flex items-start gap-2">
                <svg
                  className="mt-0.5 h-4 w-4 shrink-0 text-surface-700"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                {tLimitation(key.replace(/^limitation\./, ""))}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <MethodologyDisclosure locale={locale} />

      <div className="flex flex-wrap items-center gap-4 border-t border-surface-200 pt-6">
        <button
          type="button"
          disabled
          className="rounded-xl bg-surface-100 px-4 py-2 text-sm font-medium text-surface-700"
        >
          {t("claim_cta")}
        </button>
        <Link
          href="/"
          className="text-sm font-medium text-brand-600 transition-colors hover:text-brand-700"
        >
          {tStatus("start_new")}
        </Link>
        <DeleteButton auditId={record.id} secret={secret} />
      </div>
    </div>
  );
}
