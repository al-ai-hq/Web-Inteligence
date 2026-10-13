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
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-neutral-200 text-start">
          <th className="py-2">{t("site")}</th>
          <th className="py-2">{t("date")}</th>
          <th className="py-2">{t("status")}</th>
          <th className="py-2" />
        </tr>
      </thead>
      <tbody>
        {records.map((record) => {
          const hostname = new URL(record.target_url).hostname;
          const score =
            record.report?.score?.presence_readiness ?? null;
          return (
            <tr key={record.id} className="border-b border-neutral-100">
              <td className="py-2">{hostname}</td>
              <td className="py-2">
                {dateFormatter.format(new Date(record.created_at))}
              </td>
              <td className="py-2">
                {tStatus(`stage_${record.status}`)}
                {score !== null ? (
                  <span className="ms-2 rounded bg-neutral-100 px-1.5 py-0.5 text-xs">
                    {score}%
                  </span>
                ) : null}
              </td>
              <td className="py-2">
                <Link href={`/audit/${record.id}`} className="underline">
                  {t("view_report")}
                </Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
