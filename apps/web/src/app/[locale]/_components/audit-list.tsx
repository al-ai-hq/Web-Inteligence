import { getTranslations } from "next-intl/server";
import type { AuditRecord } from "@wpi/audit-pipeline";
import { Link } from "../../../i18n/navigation";

export async function AuditList({
  records,
  locale,
}: {
  records: AuditRecord[];
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "dashboard" });
  const tStatus = await getTranslations({ locale, namespace: "status" });
  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-200 text-start text-xs font-semibold uppercase tracking-wider text-surface-700">
            <th className="px-4 py-3">{t("site")}</th>
            <th className="px-4 py-3">{t("date")}</th>
            <th className="px-4 py-3">{t("status")}</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const hostname = new URL(record.target_url).hostname;
            const score =
              record.report?.score?.presence_readiness ?? null;
            return (
              <tr key={record.id} className="border-b border-surface-100 transition-colors hover:bg-surface-50">
                <td className="px-4 py-3 font-medium text-surface-900">{hostname}</td>
                <td className="px-4 py-3 text-surface-700">
                  {dateFormatter.format(new Date(record.created_at))}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2">
                    {tStatus(`stage_${record.status}`)}
                    {score !== null ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        score >= 80 ? "bg-emerald-100 text-emerald-700" :
                        score >= 60 ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {score}%
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="px-4 py-3 text-end">
                  <Link href={`/audit/${record.id}`} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-brand-600 transition-colors hover:bg-brand-50 hover:text-brand-700">
                    {t("view_report")}
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
