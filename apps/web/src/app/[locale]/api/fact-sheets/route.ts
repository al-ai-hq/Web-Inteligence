import { NextRequest, NextResponse } from "next/server";
import { getAuditServices } from "../../../../services/container";
import { FactSheetCreateSchema } from "@wpi/footprint-store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = FactSheetCreateSchema.safeParse(body);
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
    record_id: crypto.randomUUID(),
    project_id: parsed.data.project_id,
    site_id: null,
    source_type: "first_party" as const,
    source_id: "manual-entry",
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

  const factSheet = await store.create(parsed.data, lineage);
  return NextResponse.json(factSheet, { status: 201 });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");

  if (!projectId) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }

  const services = await getAuditServices();
  if (!services.pool) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { FactSheetStore } = await import("@wpi/footprint-store");
  const store = new FactSheetStore(services.pool);
  const factSheets = await store.listByProject(projectId);

  return NextResponse.json(factSheets);
}
