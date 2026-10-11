import { NextRequest, NextResponse } from "next/server";
import { getAuditServices } from "../../../../../services/container";
import { FactSheetCreateSchema } from "@wpi/footprint-store";

export const runtime = "nodejs";

export async function GET(
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
  const factSheet = await store.getById(id);

  if (!factSheet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(factSheet);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const body = await request.json();
  const parsed = FactSheetCreateSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const services = await getAuditServices();
  if (!services.pool) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { FactSheetStore } = await import("@wpi/footprint-store");
  const store = new FactSheetStore(services.pool);

  const lineage = {
    record_id: id,
    project_id: "",
    site_id: null,
    source_type: "first_party" as const,
    source_id: "manual-update",
    source_version: "1.0.0",
    captured_at: new Date().toISOString(),
    as_of: new Date().toISOString(),
    market: "US",
    language: "en",
    device: "desktop" as const,
    method: "manual",
    methodology_version: "1.0.0",
    fidelity_label: "confirmed" as const,
    content_hash: crypto.randomUUID(),
    parent_ids: [],
    validation_state: "validated" as const,
  };

  const factSheet = await store.update(id, parsed.data, lineage);
  return NextResponse.json(factSheet);
}
