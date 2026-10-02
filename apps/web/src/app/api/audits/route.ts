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
import { getAuditServices } from "../../../services/container";

export const runtime = "nodejs";

const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "url_invalid" }, { status: 400 });
  }

  const parsed = createAuditRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "url_invalid" }, { status: 400 });
  }

  const services = await getAuditServices();
  const urlCheck = await services.validateUrl(parsed.data.url);
  if (!urlCheck.ok) {
    return NextResponse.json({ error: "url_invalid" }, { status: 400 });
  }

  // reCAPTCHA enforcement lands with the identity decision (docs/decisions.md D-011).
  void process.env["WPI_RECAPTCHA_SECRET"];

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
  });

  void services.dispatcher.dispatch(record.id);

  const response = NextResponse.json(
    { id: record.id, secret, status_url: `/${parsed.data.locale}/audit/${record.id}` },
    { status: 201 },
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
