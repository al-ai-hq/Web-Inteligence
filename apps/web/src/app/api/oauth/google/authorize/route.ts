import { NextResponse } from "next/server";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export async function GET(request: Request) {
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
    redirect_uri: `${appUrl}/api/oauth/google/callback`,
    response_type: "code",
    scope: [
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
