import { NextResponse, type NextRequest } from "next/server";
import { forgotPasswordSchema } from "@wpi/auth";
import { passwordResetTemplate } from "@wpi/email";
import { getClientIp } from "../../../../services/client-ip";
import { getAuditServices } from "../../../../services/container";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const services = await getAuditServices();
  const ip = getClientIp(request);
  const limit = await services.rateLimiter.checkAnonymous(ip);
  if (!limit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    await services.rateLimiter.recordFailure(ip);
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    await services.rateLimiter.recordFailure(ip);
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const token = await services.auth.createPasswordResetToken(parsed.data.email);
  if (token) {
    const locale = parsed.data.locale ?? "en";
    const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";
    const resetUrl = `${appUrl}/${locale}/reset-password?token=${encodeURIComponent(token)}`;
    const { subject, html, text } = passwordResetTemplate({
      locale,
      resetUrl,
      expiresInMinutes: 15,
    });
    void services.emailService
      .send({
        to: parsed.data.email,
        subject,
        html,
        text,
        locale,
      })
      .catch((error: unknown) => {
        console.error("Failed to send password reset email:", error);
      });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
