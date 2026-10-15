export async function verifyTurnstileToken(token: string, ip?: string): Promise<boolean> {
  const secret = process.env["TURNSTILE_SECRET_KEY"];
  if (!secret) {
    return false;
  }

  const body: Record<string, string> = { secret, response: token };
  if (ip) {
    body["remoteip"] = ip;
  }

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      return false;
    }
    const data = (await response.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
