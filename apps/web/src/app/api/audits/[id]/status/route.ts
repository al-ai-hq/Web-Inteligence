import { NextResponse, type NextRequest } from "next/server";
import { authorizeRecord } from "../../../../../services/access";
import { getAuditServices } from "../../../../../services/container";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NO_INDEX_HEADERS = {
  "X-Robots-Tag": "noindex, nofollow",
  "Cache-Control": "no-store",
} as const;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_INDEX_HEADERS });
  }

  const services = await getAuditServices();
  const secret = request.nextUrl.searchParams.get("s") ?? undefined;
  const outcome = await authorizeRecord(services.store, id, secret);

  if (outcome.kind === "authorized") {
    return NextResponse.json(
      {
        id,
        status: outcome.record.status,
        failure_reason: outcome.record.failure_reason,
        has_report: outcome.record.report !== null,
      },
      { headers: NO_INDEX_HEADERS },
    );
  }
  if (outcome.kind === "deleted" || outcome.kind === "expired") {
    return NextResponse.json({ error: outcome.kind }, { status: 410, headers: NO_INDEX_HEADERS });
  }
  return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_INDEX_HEADERS });
}
