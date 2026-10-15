import { NextResponse, type NextRequest } from "next/server";
import {
  createAuditRequestSchema,
  decideTier,
  ELIGIBILITY_COOKIE_NAME,
  generateAuditSecret,
  hashAuditSecret,
  incrementEligibilityCookie,
  verifyEligibilityCookie,
} from "@wpi/audit-pipeline";
import { hashToken, SESSION_COOKIE_NAME } from "@wpi/auth";
import { verifyTurnstileToken } from "@wpi/rate-limiter";
import { z } from "zod";
import { authorizeRecord } from "../../../services/access";
import { getClientIp } from "../../../services/client-ip";
import { getAuditServices } from "../../../services/container";

export const runtime = "nodejs";

const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_INDEX_HEADERS = {
  "X-Robots-Tag": "noindex, nofollow",
  "Cache-Control": "no-store",
} as const;

const createAuditRouteSchema = createAuditRequestSchema.merge(
  z.object({
    turnstileToken: z.string().max(2048).optional(),
  }),
);

function rateLimitHeaders(result: { limit: number; remaining: number; resetAt: Date }): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(Math.max(0, result.remaining)),
    "X-RateLimit-Reset": String(Math.floor(result.resetAt.getTime() / 1000)),
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_INDEX_HEADERS });
  }

  const services = await getAuditServices();
  const cookieValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const user = cookieValue
    ? await services.auth.getSessionUser(hashToken(cookieValue))
    : null;
  const secret = request.nextUrl.searchParams.get("s") ?? undefined;
  const outcome = await authorizeRecord(services.store, id, secret, user?.id ?? null);

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

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "url_invalid" }, { status: 400 });
  }

  const parsed = createAuditRouteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "url_invalid" }, { status: 400 });
  }

  const services = await getAuditServices();
  const ip = getClientIp(request);

  const cookieValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const sessionTokenHash = cookieValue ? hashToken(cookieValue) : "";
  const user = cookieValue
    ? await services.auth.getSessionUser(sessionTokenHash)
    : null;

  const suspicious = await services.rateLimiter.isSuspicious(ip);
  if (suspicious) {
    const token = parsed.data.turnstileToken;
    if (!token || !(await verifyTurnstileToken(token, ip))) {
      const stateResult = user
        ? await services.rateLimiter.userState(user.id, user.id)
        : await services.rateLimiter.anonymousState(ip);
      return NextResponse.json(
        { error: "turnstile_required" },
        {
          status: 400,
          headers: rateLimitHeaders(stateResult),
        },
      );
    }
  }

  const rateLimitResult = user
    ? await services.rateLimiter.checkUser(user.id, user.id)
    : await services.rateLimiter.checkAnonymous(ip);

  if (!rateLimitResult.allowed) {
    const retryAfter = Math.max(
      0,
      Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000),
    );
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: {
          ...rateLimitHeaders(rateLimitResult),
          "Retry-After": String(retryAfter),
        },
      },
    );
  }

  const urlCheck = await services.validateUrl(parsed.data.url);
  if (!urlCheck.ok) {
    await services.rateLimiter.recordFailure(ip);
    return NextResponse.json(
      { error: "url_invalid" },
      { status: 400, headers: rateLimitHeaders(rateLimitResult) },
    );
  }

  const counts =
    verifyEligibilityCookie(
      request.cookies.get(ELIGIBILITY_COOKIE_NAME)?.value ?? "",
      services.cookieSecret,
    ) ?? { rich_count: 0, reduced_count: 0, preview_count: 0 };

  const tier = decideTier(counts);
  const secret = generateAuditSecret();
  const record = await services.store.create({
    targetUrl: parsed.data.url,
    locale: parsed.data.locale,
    context: parsed.data.context,
    tier,
    secretHash: hashAuditSecret(secret),
    ttlDays: 7,
    userId: user?.id ?? null,
  });

  void services.dispatcher.dispatch(record.id).catch(() => undefined);

  const response = NextResponse.json(
    { id: record.id, secret, status_url: `/${parsed.data.locale}/audit/${record.id}`, redirect_url: user ? `/${parsed.data.locale}/dashboard` : null },
    { status: 201, headers: rateLimitHeaders(rateLimitResult) },
  );
  response.cookies.set(
    ELIGIBILITY_COOKIE_NAME,
    incrementEligibilityCookie(counts, tier, services.cookieSecret),
    {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE_SECONDS,
      secure: process.env["NODE_ENV"] === "production",
    },
  );
  return response;
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const services = await getAuditServices();
  const cookieValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const user = cookieValue
    ? await services.auth.getSessionUser(hashToken(cookieValue))
    : null;
  const secret = request.nextUrl.searchParams.get("s") ?? undefined;
  const outcome = await authorizeRecord(services.store, id, secret, user?.id ?? null);

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
