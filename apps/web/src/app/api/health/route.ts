import { NextResponse, type NextRequest } from "next/server";
import { getAuditServices } from "../../../services/container";

export const runtime = "nodejs";

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const services = await getAuditServices();
  if (services.pool) {
    await services.pool.query("SELECT 1");
  }
  return NextResponse.json({ status: "ok" }, { status: 200 });
}
