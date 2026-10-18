import { getTranslations } from "next-intl/server";
import type { RecommendationOutcome, StoredActionItem } from "@wpi/audit-pipeline";
import { Link } from "../../../../i18n/navigation";
import {
  formatDelta,
  formatPercentage,
  measureLabelKey,
  measuredOutcomes,
  pendingOutcomes,
} from "../../../../services/recommendation-view";

export async function RecommendationsPanel({
  outcomes,
  quickWins,
  auditId,
  locale,
}: {
  outcomes: RecommendationOutcome[];
  quickWins: StoredActionItem[];
  auditId: string | null;
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "dashboard" });
  const tReport = await getTranslations({ locale, namespace: "report" });
  const formatDate = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  const measured = measuredOutcomes(outcomes);
  const pending = pendingOutcomes(outcomes);

  if (measured.length === 0 && pending.length === 0 && quickWins.length === 0) {
    return (
      <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-surface-900">{t("recommendations_title")}</h2>
        <p className="mt-2 text-sm text-surface-700">{t("recommendations_empty")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-2xl border border-surface-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-surface-900">{t("recommendations_title")}</h2>

      {measured.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-surface-800">{t("deltas_title")}</h3>
          <ul className="space-y-3">
            {measured.map((row) => {
              const delta = formatDelta(row.value_before, row.value_after);
              const label = tReport(measureLabelKey(row.metric));
              return (
                <li key={row.id} className="rounded-xl bg-surface-50 p-4">
                  {delta !== null && row.value_before !== null && row.value_after !== null ? (
                    <p className="text-sm text-surface-800">
                      {t("delta_line", {
                        date: formatDate.format(new Date(row.as_of_after ?? row.updated_at)),
                        metric: label,
                        before: formatPercentage(row.value_before),
                        after: formatPercentage(row.value_after),
                        delta,
                      })}
                    </p>
                  ) : (
                    <p className="text-sm text-surface-700">
                      {t("delta_no_values", { metric: label })}
                    </p>
                  )}
                  <p className="mt-1.5 text-xs text-surface-500">
                    <bdi>{row.rule_id}</bdi> &middot; {t("fidelity")}:{" "}
                    {t(`fidelity_${row.fidelity_label}`)}
                  </p>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-surface-700">{t("delta_disclaimer")}</p>
        </section>
      ) : null}

      {pending.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-surface-800">{t("pending_title")}</h3>
          <ul className="space-y-2">
            {pending.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-x-2 text-sm">
                <bdi className="font-medium text-surface-900">{row.rule_id}</bdi>
                <span className="text-surface-700">
                  {t("applied_on", { date: formatDate.format(new Date(row.created_at)) })}
                </span>
                <span className="text-surface-500">
                  {t("fidelity")}: {t(`fidelity_${row.fidelity_label}`)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {quickWins.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-surface-800">{t("quick_wins_title")}</h3>
          <ul className="space-y-2">
            {quickWins.map((item) => (
              <li key={item.source_finding_id} className="text-sm text-surface-800">
                <bdi className="font-medium">{item.title}</bdi>
                <p className="mt-0.5 text-surface-700">{item.detail}</p>
              </li>
            ))}
          </ul>
          {auditId !== null ? (
            <Link
              href={`/audit/${auditId}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 transition-colors hover:text-brand-700"
            >
              {t("view_report")}
              <svg
                className="h-3.5 w-3.5"
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
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
