import { getAuditServices } from "../../../../../../services/container";
import { FactSheetStore } from "@wpi/footprint-store";
import { Link } from "../../../../../../i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function FactSheetsPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "fact-sheets" });
  const services = await getAuditServices();

  if (!services.pool) {
    return <div>{t("database_not_configured")}</div>;
  }

  const store = new FactSheetStore(services.pool);
  const factSheets = await store.listByProject(projectId);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Link
          href={`/projects/${projectId}/fact-sheets/new`}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {t("create_new")}
        </Link>
      </div>

      {factSheets.length === 0 ? (
        <p className="text-gray-500">{t("empty_state")}</p>
      ) : (
        <div className="grid gap-4">
          {factSheets.map((fs) => (
            <Link
              key={fs.id}
              href={`/projects/${projectId}/fact-sheets/${fs.id}`}
              className="block p-4 border rounded hover:border-blue-500 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{fs.business_name}</h2>
                  <p className="text-sm text-gray-500">{fs.site_url}</p>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs ${
                    fs.status === "confirmed"
                      ? "bg-green-100 text-green-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {t(`status.${fs.status}`)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
