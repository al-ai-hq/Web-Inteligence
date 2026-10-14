import { NextResponse, type NextRequest } from "next/server";
import {
  loginSchema,
  signupSchema,
  DuplicateEmailError,
  hashToken,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "@wpi/auth";
import { getAuditServices } from "../../../services/container";
import { getClientIp } from "../../../services/client-ip";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const action = request.nextUrl.searchParams.get("action");

  if (action === "logout") {
    return handleLogout(request);
  }

  if (action === "signup") {
    return handleSignup(request);
  }

  return handleLogin(request);
}

async function handleLogin(request: NextRequest): Promise<NextResponse> {
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

async function handleSignup(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
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

  try {
    const user = await services.auth.createUser(parsed.data.email, parsed.data.password);
    const session = await services.auth.createSession(user.id);
    services.rateLimiter.reset(ipKey);
    services.rateLimiter.reset(emailKey);

    const response = NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
    response.cookies.set(SESSION_COOKIE_NAME, session.token, sessionCookieOptions());
    return response;
  } catch (error) {
    if (error instanceof DuplicateEmailError) {
      services.rateLimiter.recordFailure(ipKey);
      services.rateLimiter.recordFailure(emailKey);
      return NextResponse.json({ error: "email_taken" }, { status: 409 });
    }
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }
}

async function handleLogout(request: NextRequest): Promise<NextResponse> {
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
