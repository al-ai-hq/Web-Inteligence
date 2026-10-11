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

  const { EntityConflictStore } = await import("@wpi/footprint-store");
  const store = new EntityConflictStore(services.pool);
  const conflicts = await store.listByFactSheet(id);

  return NextResponse.json(conflicts);
}
