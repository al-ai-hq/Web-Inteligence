import { NextResponse, type NextRequest } from "next/server";
import {
  loginSchema,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "@wpi/auth";
import { getAuditServices } from "../../../../services/container";
import { getClientIp } from "../../../../services/client-ip";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const services = await getAuditServices();
  const ip = getClientIp(request);
  const ipKey = `ip:${ip}`;
  const emailKey = `email:${parsed.data.email}`;

  if (services.rateLimiter.isBlocked(ipKey) || services.rateLimiter.isBlocked(emailKey)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const user = await services.auth.verifyCredentials(parsed.data.email, parsed.data.password);
  if (!user) {
    services.rateLimiter.recordFailure(ipKey);
    services.rateLimiter.recordFailure(emailKey);
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const session = await services.auth.createSession(user.id);
  services.rateLimiter.reset(ipKey);
  services.rateLimiter.reset(emailKey);

  const response = NextResponse.json({ id: user.id, email: user.email }, { status: 200 });
  response.cookies.set(SESSION_COOKIE_NAME, session.token, sessionCookieOptions());
  return response;
}
