import { NextResponse, type NextRequest } from "next/server";
import { authorizeRecord } from "../../../../services/access";
import { getAuditServices } from "../../../../services/container";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const services = await getAuditServices();
  const secret = request.nextUrl.searchParams.get("s") ?? undefined;
  const outcome = await authorizeRecord(services.store, id, secret);

  if (outcome.kind === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (outcome.kind === "deleted" || outcome.kind === "expired") {
    return NextResponse.json({ error: outcome.kind }, { status: 410 });
  }
  const deleted = await services.store.softDelete(id);
  if (!deleted) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
