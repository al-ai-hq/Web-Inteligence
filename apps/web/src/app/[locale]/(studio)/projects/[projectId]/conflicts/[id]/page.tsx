import { getAuditServices } from "../../../../../../../services/container";
import {
  FactSheetStore,
  EntityConflictStore,
} from "@wpi/footprint-store";
import { notFound } from "next/navigation";
import { Link } from "../../../../../../../i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ConflictList } from "./_components/conflict-list";

export default async function ConflictsPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string; id: string }>;
}) {
  const { locale, projectId, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "conflicts" });
  const services = await getAuditServices();

  if (!services.pool) {
    return <div>{t("database_not_configured")}</div>;
  }

  const factSheetStore = new FactSheetStore(services.pool);
  const conflictStore = new EntityConflictStore(services.pool);

  const [factSheet, conflicts] = await Promise.all([
    factSheetStore.getById(id),
    conflictStore.listByFactSheet(id),
  ]);

  if (!factSheet) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href={`/projects/${projectId}/entity-graph/${id}`}
          className="text-blue-600 hover:underline"
        >
          &larr; {t("back_to_entity_graph")}
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-2">{factSheet.business_name}</h1>
      <p className="text-gray-500 mb-6">{t("conflicts_subtitle")}</p>

      <ConflictList
        conflicts={conflicts}
        factSheetId={id}
        locale={locale}
        projectId={projectId}
      />
    </div>
  );
}
