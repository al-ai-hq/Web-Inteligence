import { NextRequest, NextResponse } from "next/server";
import { getAuditServices } from "../../../../../../services/container";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const body = await request.json().catch(() => ({}));
  const { confirmed_value, resolved_by, resolution_note } = body;

  if (confirmed_value === undefined || confirmed_value === null || !resolved_by) {
    return NextResponse.json(
      { error: "confirmed_value and resolved_by are required" },
      { status: 400 },
    );
  }

  const services = await getAuditServices();
  if (!services.pool) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { EntityConflictStore } = await import("@wpi/footprint-store");
  const store = new EntityConflictStore(services.pool);

  const conflict = await store.resolve(
    id,
    confirmed_value,
    resolved_by,
    resolution_note ?? "",
  );

  return NextResponse.json(conflict);
}
