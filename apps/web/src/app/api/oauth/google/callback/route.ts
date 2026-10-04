import { NextResponse } from "next/server";
import { TokenStore } from "@wpi/oauth";
import { Pool } from "pg";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect("/en/settings/integrations?error=access_denied");
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
  const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";
  const databaseUrl = process.env["WPI_DATABASE_URL"];

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
      redirect_uri: `${appUrl}/api/oauth/google/callback`,
    }),
  });

  if (!tokenResponse.ok) {
    return NextResponse.redirect("/en/settings/integrations?error=token_exchange_failed");
  }

  const tokens = await tokenResponse.json();
  const expiresAt = new Date(Date.now() + (tokens.expires_in as number) * 1000);

  const pool = new Pool({ connectionString: databaseUrl });
  const tokenStore = new TokenStore(pool);

  const userId = "placeholder";

  await tokenStore.save({
    userId,
    provider: "google",
    siteUrl: decodeURIComponent(siteUrlCookie),
    accessToken: tokens.access_token as string,
    refreshToken: tokens.refresh_token as string | undefined,
    expiresAt,
  });

  await pool.end();

  const response = NextResponse.redirect("/en/settings/integrations?connected=true");
  response.cookies.delete("oauth_state");
  response.cookies.delete("oauth_site_url");
  return response;
}
