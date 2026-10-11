import { getAuditServices } from "../../../../../../../services/container";
import {
  FactSheetStore,
  PublicSourceObservationStore,
  ProfileObservationStore,
  NapObservationStore,
  EntityConflictStore,
} from "@wpi/footprint-store";
import { notFound } from "next/navigation";
import { Link } from "../../../../../../../i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EntityGraphViz } from "./_components/entity-graph-viz";

export default async function EntityGraphPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string; id: string }>;
}) {
  const { locale, projectId, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "entity-graph" });
  const services = await getAuditServices();

  if (!services.pool) {
    return <div>{t("database_not_configured")}</div>;
  }

  const factSheetStore = new FactSheetStore(services.pool);
  const publicSourceStore = new PublicSourceObservationStore(services.pool);
  const profileStore = new ProfileObservationStore(services.pool);
  const napStore = new NapObservationStore(services.pool);
  const conflictStore = new EntityConflictStore(services.pool);

  const [factSheet, publicSources, profiles, napObservations, conflicts] =
    await Promise.all([
      factSheetStore.getById(id),
      publicSourceStore.listByFactSheet(id),
      profileStore.listByFactSheet(id),
      napStore.listByFactSheet(id),
      conflictStore.listByFactSheet(id),
    ]);

  if (!factSheet) {
    notFound();
  }

  const openConflicts = conflicts.filter(
    (c) => c.status === "open" || c.status === "owner_confirmed_value" || c.status === "correction_requested",
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href={`/projects/${projectId}/fact-sheets/${id}`}
          className="text-blue-600 hover:underline"
        >
          &larr; {t("back_to_fact_sheet")}
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-2">{factSheet.business_name}</h1>
      <p className="text-gray-500 mb-6">{t("entity_graph_subtitle")}</p>

      {openConflicts.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-6">
          <div className="flex items-center justify-between">
            <p className="text-yellow-800">
              <strong>{openConflicts.length}</strong> {t("open_conflicts")}
            </p>
            <Link
              href={`/projects/${projectId}/conflicts/${id}`}
              className="text-yellow-800 underline hover:no-underline"
            >
              {t("view_conflicts")} &rarr;
            </Link>
          </div>
        </div>
      )}

      <EntityGraphViz
        factSheet={factSheet}
        publicSources={publicSources}
        profiles={profiles}
        napObservations={napObservations}
      />
    </div>
  );
}
