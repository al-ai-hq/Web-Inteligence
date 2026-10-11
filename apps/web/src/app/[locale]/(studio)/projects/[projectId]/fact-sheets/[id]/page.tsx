import { getAuditServices } from "../../../../../../../services/container";
import { FactSheetStore } from "@wpi/footprint-store";
import { notFound } from "next/navigation";
import { Link } from "../../../../../../../i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function FactSheetDetailPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string; id: string }>;
}) {
  const { locale, projectId, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "fact-sheets" });
  const services = await getAuditServices();

  if (!services.pool) {
    return <div>{t("database_not_configured")}</div>;
  }

  const store = new FactSheetStore(services.pool);
  const factSheet = await store.getById(id);

  if (!factSheet) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href={`/projects/${projectId}/fact-sheets`}
          className="text-blue-600 hover:underline"
        >
          &larr; {t("back_to_list")}
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{factSheet.business_name}</h1>
        <span
          className={`px-3 py-1 rounded text-sm ${
            factSheet.status === "confirmed"
              ? "bg-green-100 text-green-800"
              : "bg-yellow-100 text-yellow-800"
          }`}
        >
          {t(`status.${factSheet.status}`)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t("contact_info")}</h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-gray-500">{t("website")}</dt>
              <dd>
                <a href={factSheet.site_url} className="text-blue-600 hover:underline">
                  {factSheet.site_url}
                </a>
              </dd>
            </div>
            {factSheet.phone && (
              <div>
                <dt className="text-sm text-gray-500">{t("phone")}</dt>
                <dd>{factSheet.phone}</dd>
              </div>
            )}
            {factSheet.email && (
              <div>
                <dt className="text-sm text-gray-500">{t("email")}</dt>
                <dd>{factSheet.email}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t("address")}</h2>
          {factSheet.address_line1 ? (
            <address className="not-italic">
              {factSheet.address_line1}
              {factSheet.address_line2 && <br />}
              {factSheet.address_line2}
              <br />
              {factSheet.address_locality}, {factSheet.address_region} {factSheet.address_postal_code}
              <br />
              {factSheet.address_country}
            </address>
          ) : (
            <p className="text-gray-500">{t("no_address")}</p>
          )}
        </div>
      </div>

      <div className="mt-8 flex gap-3">
        <Link
          href={`/projects/${projectId}/fact-sheets/${id}/edit`}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {t("edit")}
        </Link>
        <Link
          href={`/projects/${projectId}/entity-graph/${id}`}
          className="bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200"
        >
          {t("view_entity_graph")}
        </Link>
      </div>
    </div>
  );
}
