import { NextResponse, type NextRequest } from "next/server";
import { hashToken, SESSION_COOKIE_NAME, sessionCookieOptions } from "@wpi/auth";
import { getAuditServices } from "../../../../services/container";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const services = await getAuditServices();
    await services.auth.destroySession(hashToken(token));
  }

  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}
