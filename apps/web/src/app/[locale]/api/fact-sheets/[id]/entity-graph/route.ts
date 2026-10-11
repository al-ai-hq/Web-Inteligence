import { NextRequest, NextResponse } from "next/server";
import { getAuditServices } from "../../../../../../services/container";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const services = await getAuditServices();
  if (!services.pool) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { FactSheetStore, PublicSourceObservationStore, ProfileObservationStore, NapObservationStore } =
    await import("@wpi/footprint-store");

  const factSheetStore = new FactSheetStore(services.pool);
  const publicSourceStore = new PublicSourceObservationStore(services.pool);
  const profileStore = new ProfileObservationStore(services.pool);
  const napStore = new NapObservationStore(services.pool);

  const [factSheet, publicSources, profiles, napObservations] = await Promise.all([
    factSheetStore.getById(id),
    publicSourceStore.listByFactSheet(id),
    profileStore.listByFactSheet(id),
    napStore.listByFactSheet(id),
  ]);

  if (!factSheet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    fact_sheet: factSheet,
    public_sources: publicSources,
    profile_observations: profiles,
    nap_observations: napObservations,
  });
}
