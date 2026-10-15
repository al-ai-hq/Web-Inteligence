import { NextResponse, type NextRequest } from "next/server";
import { TokenStore } from "@wpi/oauth";
import { Pool } from "pg";

export const runtime = "nodejs";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const action = request.nextUrl.searchParams.get("action");

  if (action === "callback") {
    return handleCallback(request);
  }

  return handleAuthorize(request);
}

async function handleAuthorize(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const siteUrl = searchParams.get("site_url");
  if (!siteUrl) {
    return NextResponse.json({ error: "site_url required" }, { status: 400 });
  }

  const clientId = process.env["GOOGLE_OAUTH_CLIENT_ID"];
  if (!clientId) {
    return NextResponse.json({ error: "Google OAuth not configured" }, { status: 500 });
  }

  const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/api/oauth/google?action=callback`,
    response_type: "code",
    scope: [
      "openid",
      "email",
      "https://www.googleapis.com/auth/webmasters.readonly",
      "https://www.googleapis.com/auth/analytics.readonly",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
    include_granted_scopes: "true",
  });

  const response = NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params}`);
  response.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  response.cookies.set("oauth_site_url", siteUrl, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}

async function handleCallback(request: NextRequest): Promise<NextResponse> {
  const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${appUrl}/en/settings/integrations?error=access_denied`);
  }

  if (!code || !state) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  const cookies = request.headers.get("cookie") ?? "";
  const stateCookie = cookies
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("oauth_state="))
    ?.split("=")[1];
  const siteUrlCookie = cookies
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("oauth_site_url="))
    ?.split("=")[1];

  if (!stateCookie || state !== stateCookie) {
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  }

  if (!siteUrlCookie) {
    return NextResponse.json({ error: "Missing site URL" }, { status: 400 });
  }

  const clientId = process.env["GOOGLE_OAUTH_CLIENT_ID"];
  const clientSecret = process.env["GOOGLE_OAUTH_CLIENT_SECRET"];
  const databaseUrl = process.env["DATABASE_URL"] ?? process.env["WPI_DATABASE_URL"];

  if (!clientId || !clientSecret || !databaseUrl) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${appUrl}/api/oauth/google?action=callback`,
    }),
  });

  if (!tokenResponse.ok) {
    return NextResponse.redirect(`${appUrl}/en/settings/integrations?error=token_exchange_failed`);
  }

  const tokens = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    id_token?: string;
  };
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  const userId = extractUserIdFromIdToken(tokens.id_token);
  if (!userId) {
    return NextResponse.redirect(`${appUrl}/en/settings/integrations?error=missing_identity`);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const tokenStore = new TokenStore(pool);

  await tokenStore.save({
    userId,
    provider: "google",
    siteUrl: decodeURIComponent(siteUrlCookie),
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt,
  });

  await pool.end();

  const response = NextResponse.redirect(`${appUrl}/en/settings/integrations?connected=true`);
  response.cookies.delete("oauth_state");
  response.cookies.delete("oauth_site_url");
  return response;
}

function extractUserIdFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const payload = idToken.split(".")[1];
    if (!payload) return null;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")) as {
      email?: string;
    };
    return decoded.email ?? null;
  } catch {
    return null;
  }
}
