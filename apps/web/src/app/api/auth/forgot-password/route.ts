import { NextResponse, type NextRequest } from "next/server";
import { forgotPasswordSchema } from "@wpi/auth";
import { passwordResetTemplate } from "@wpi/email";
import { getAuditServices } from "../../../../services/container";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const services = await getAuditServices();
  const token = await services.auth.createPasswordResetToken(parsed.data.email);
  if (token) {
    const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";
    const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;
    const { subject, html, text } = passwordResetTemplate({
      locale: "en",
      resetUrl,
      expiresInMinutes: 15,
    });
    void services.emailService
      .send({
        to: parsed.data.email,
        subject,
        html,
        text,
        locale: "en",
      })
      .catch((error: unknown) => {
        console.error("Failed to send password reset email:", error);
      });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
