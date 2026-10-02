import { getTranslations } from "next-intl/server";
import type { AuditRecord, StoredFinding, StoredReportEnvelope } from "@wpi/audit-pipeline";
import { Link } from "../../../../../i18n/navigation";
import { DeleteButton } from "./delete-button";

const SECTIONS = ["technical", "keywords", "content"] as const;

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

type AuditRecordWithReport = AuditRecord & { report: StoredReportEnvelope };

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
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{t("sections_title")}</h1>
        <p className="text-sm text-neutral-600">
          {tStatus(`stage_${record.status}`)}
        </p>
        {envelope.report.content.sample_disclosure.sampled ? (
          <p className="text-sm text-neutral-500">
            {t("sample_disclosure", {
              pages: envelope.report.content.sample_disclosure.pages_checked,
            })}
          </p>
        ) : null}
      </header>

      {envelope.report.content.summary_bullets.length > 0 ? (
        <ul className="list-disc space-y-1 ps-6">
          {envelope.report.content.summary_bullets.map((bullet) => (
            <li key={bullet}>{t(SUMMARY_LABEL_KEYS[bullet] ?? bullet)}</li>
          ))}
        </ul>
      ) : null}

      {SECTIONS.map((section) => {
        const findings = envelope.findings.filter((finding) => finding.section === section);
        if (findings.length === 0) {
          return null;
        }
        return (
          <section key={section} className="space-y-4">
            <h2 className="text-xl font-semibold">{t(`section_${section}`)}</h2>
            <ul className="space-y-3">
              {findings.map((finding) => (
                <li key={finding.id} className="rounded border border-neutral-200 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-neutral-900 px-2 py-0.5 text-xs text-white">
                      {t(`severity_${finding.severity}`)}
                    </span>
                    <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
                      {t(`state_${finding.state}`)}
                    </span>
                    <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
                      {t(`confidence_${finding.confidence}`)}
                    </span>
                  </div>
                  <p className="mt-2 font-medium">{findingTitle(finding)}</p>
                  {findingDetail(finding) !== undefined ? (
                    <p className="mt-1 text-sm text-neutral-600">{findingDetail(finding)}</p>
                  ) : null}
                  {finding.evidence_ids.length > 0 ? (
                    <p className="mt-2 text-xs text-neutral-500">
                      {finding.evidence_ids
                        .map((evidenceId) => `${t("evidence_label")} ${evidenceId.slice(0, 8)}`)
                        .join(" · ")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {envelope.action_board.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">{t("action_board_title")}</h2>
          <ol className="space-y-2">
            {envelope.action_board.map((item) => (
              <li key={item.source_finding_id} className="rounded border border-neutral-200 p-4">
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 text-sm text-neutral-600">{item.detail}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {envelope.unavailable.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">{t("unavailable_title")}</h2>
          <ul className="list-disc space-y-1 ps-6 text-sm text-neutral-600">
            {envelope.unavailable.map((block) => (
              <li key={`${block.section}:${block.reason_key}`}>{tUnavailable(block.reason_key.replace(/^unavailable\./, ""))}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {envelope.report.content.limitations_keys.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">{t("limitations_title")}</h2>
          <ul className="list-disc space-y-1 ps-6 text-sm text-neutral-600">
            {envelope.report.content.limitations_keys.map((key) => (
              <li key={key}>{tLimitation(key.replace(/^limitation\./, ""))}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-4 border-t border-neutral-200 pt-6">
        <button type="button" disabled className="rounded bg-neutral-200 px-4 py-2 text-sm text-neutral-500">
          {t("claim_cta")}
        </button>
        <Link href="/" className="text-sm underline">
          {tStatus("start_new")}
        </Link>
        <DeleteButton auditId={record.id} secret={secret} />
      </div>
    </div>
  );
}
