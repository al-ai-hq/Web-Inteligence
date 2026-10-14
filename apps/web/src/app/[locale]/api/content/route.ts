import { NextResponse, type NextRequest } from "next/server";
import { getAuditServices } from "../../../../services/container";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const action = request.nextUrl.searchParams.get("action");
  const id = request.nextUrl.searchParams.get("id");

  try {
    const services = await getAuditServices();

    switch (action) {
      case "briefs":
        return handleGetBriefs(request, services);
      case "brief":
        return handleGetBrief(request, services, id!);
      case "drafts":
        return handleGetDrafts(request, services);
      case "draft":
        return handleGetDraft(request, services, id!);
      case "fact-sheets":
        return handleGetFactSheets(request, services);
      case "fact-sheet":
        return handleGetFactSheet(request, services, id!);
      case "fact-sheet-conflicts":
        return handleGetFactSheetConflicts(request, services, id!);
      case "fact-sheet-entity-graph":
        return handleGetFactSheetEntityGraph(request, services, id!);
      case "fact-manifests":
        return handleGetFactManifests(request, services);
      case "fact-manifest":
        return handleGetFactManifest(request, services, id!);
      case "schema":
        return handleGetSchema(request, services);
      case "change-sets":
        return handleGetChangeSets(request, services);
      case "change-windows":
        return handleGetChangeWindows(request, services);
      default:
        return NextResponse.json({ error: "invalid_action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[content-api] GET error", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const action = request.nextUrl.searchParams.get("action");

  try {
    const services = await getAuditServices();
    const body = await request.json().catch(() => ({}));

    switch (action) {
      case "briefs":
        return handleCreateBrief(request, services, body);
      case "drafts":
        return handleCreateDraft(request, services, body);
      case "fact-sheets":
        return handleCreateFactSheet(request, services, body);
      case "fact-manifests":
        return handleCreateFactManifest(request, services, body);
      case "schema-validate":
        return handleValidateSchema(request, services, body);
      case "change-sets":
        return handleCreateChangeSet(request, services, body);
      default:
        return NextResponse.json({ error: "invalid_action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[content-api] POST error", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const action = request.nextUrl.searchParams.get("action");
  const id = request.nextUrl.searchParams.get("id");

  try {
    const services = await getAuditServices();
    const body = await request.json().catch(() => ({}));

    switch (action) {
      case "brief":
        return handleUpdateBrief(request, services, id!, body);
      case "draft":
        return handleUpdateDraft(request, services, id!, body);
      case "fact-sheet":
        return handleUpdateFactSheet(request, services, id!, body);
      default:
        return NextResponse.json({ error: "invalid_action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[content-api] PUT error", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const action = request.nextUrl.searchParams.get("action");
  const id = request.nextUrl.searchParams.get("id");

  try {
    const services = await getAuditServices();

    switch (action) {
      case "brief":
        return handleDeleteBrief(request, services, id!);
      case "draft":
        return handleDeleteDraft(request, services, id!);
      default:
        return NextResponse.json({ error: "invalid_action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[content-api] DELETE error", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

// Handler stubs - these will be implemented based on actual M8 logic
async function handleGetBriefs(_req: NextRequest, _services: any): Promise<NextResponse> {
  return NextResponse.json({ briefs: [] });
}

async function handleGetBrief(_req: NextRequest, _services: any, _id: string): Promise<NextResponse> {
  return NextResponse.json({ brief: null }, { status: 404 });
}

async function handleCreateBrief(_req: NextRequest, _services: any, _body: any): Promise<NextResponse> {
  return NextResponse.json({ brief: { id: "mock-id" } }, { status: 201 });
}

async function handleUpdateBrief(_req: NextRequest, _services: any, _id: string, _body: any): Promise<NextResponse> {
  return NextResponse.json({ brief: { id: _id } });
}

async function handleDeleteBrief(_req: NextRequest, _services: any, _id: string): Promise<NextResponse> {
  return NextResponse.json({ ok: true });
}

async function handleGetDrafts(_req: NextRequest, _services: any): Promise<NextResponse> {
  return NextResponse.json({ drafts: [] });
}

async function handleGetDraft(_req: NextRequest, _services: any, _id: string): Promise<NextResponse> {
  return NextResponse.json({ draft: null }, { status: 404 });
}

async function handleCreateDraft(_req: NextRequest, _services: any, _body: any): Promise<NextResponse> {
  return NextResponse.json({ draft: { id: "mock-id" } }, { status: 201 });
}

async function handleUpdateDraft(_req: NextRequest, _services: any, _id: string, _body: any): Promise<NextResponse> {
  return NextResponse.json({ draft: { id: _id } });
}

async function handleDeleteDraft(_req: NextRequest, _services: any, _id: string): Promise<NextResponse> {
  return NextResponse.json({ ok: true });
}

async function handleGetFactSheets(_req: NextRequest, _services: any): Promise<NextResponse> {
  return NextResponse.json({ factSheets: [] });
}

async function handleGetFactSheet(_req: NextRequest, _services: any, _id: string): Promise<NextResponse> {
  return NextResponse.json({ factSheet: null }, { status: 404 });
}

async function handleCreateFactSheet(_req: NextRequest, _services: any, _body: any): Promise<NextResponse> {
  return NextResponse.json({ factSheet: { id: "mock-id" } }, { status: 201 });
}

async function handleUpdateFactSheet(_req: NextRequest, _services: any, _id: string, _body: any): Promise<NextResponse> {
  return NextResponse.json({ factSheet: { id: _id } });
}

async function handleGetFactSheetConflicts(_req: NextRequest, _services: any, _id: string): Promise<NextResponse> {
  return NextResponse.json({ conflicts: [] });
}

async function handleGetFactSheetEntityGraph(_req: NextRequest, _services: any, _id: string): Promise<NextResponse> {
  return NextResponse.json({ entities: [], relations: [] });
}

async function handleGetFactManifests(_req: NextRequest, _services: any): Promise<NextResponse> {
  return NextResponse.json({ manifests: [] });
}

async function handleGetFactManifest(_req: NextRequest, _services: any, _id: string): Promise<NextResponse> {
  return NextResponse.json({ manifest: null }, { status: 404 });
}

async function handleCreateFactManifest(_req: NextRequest, _services: any, _body: any): Promise<NextResponse> {
  return NextResponse.json({ manifest: { id: "mock-id" } }, { status: 201 });
}

async function handleGetSchema(_req: NextRequest, _services: any): Promise<NextResponse> {
  return NextResponse.json({ schema: {} });
}

async function handleValidateSchema(_req: NextRequest, _services: any, _body: any): Promise<NextResponse> {
  return NextResponse.json({ valid: true, errors: [] });
}

async function handleGetChangeSets(_req: NextRequest, _services: any): Promise<NextResponse> {
  return NextResponse.json({ changeSets: [] });
}

async function handleCreateChangeSet(_req: NextRequest, _services: any, _body: any): Promise<NextResponse> {
  return NextResponse.json({ changeSet: { id: "mock-id" } }, { status: 201 });
}

async function handleGetChangeWindows(_req: NextRequest, _services: any): Promise<NextResponse> {
  return NextResponse.json({ windows: [] });
}
