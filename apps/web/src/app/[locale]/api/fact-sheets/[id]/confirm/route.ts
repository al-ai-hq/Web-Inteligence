import { NextRequest, NextResponse } from "next/server";
import { getAuditServices } from "../../../../../../services/container";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const services = await getAuditServices();
  if (!services.pool) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { FactSheetStore } = await import("@wpi/footprint-store");
  const store = new FactSheetStore(services.pool);

  const body = await request.json().catch(() => ({}));
  const confirmedBy = body.confirmed_by ?? "anonymous";

  const factSheet = await store.confirm(id, confirmedBy);
  return NextResponse.json(factSheet);
}
