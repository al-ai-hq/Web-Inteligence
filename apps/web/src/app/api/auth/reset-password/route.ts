import { NextResponse, type NextRequest } from "next/server";
import { resetPasswordSchema } from "@wpi/auth";
import { getAuditServices } from "../../../../services/container";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const services = await getAuditServices();
  const ok = await services.auth.consumePasswordResetToken(
    parsed.data.token,
    parsed.data.password,
  );
  if (!ok) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
