import { validateUrl } from "@wpi/security";

export interface InterceptableRequest {
  url(): string;
  resourceType(): string;
}

const ALLOWED_SCHEMES = new Set(["http:", "https:"]);

function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return "<invalid-url>";
  }
}

export async function interceptRequest(request: InterceptableRequest): Promise<boolean> {
  const url = request.url();

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    console.warn(`SSRF attempt blocked — host=${redactUrl(url)} reason=invalid-url`);
    return false;
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    console.warn(
      `SSRF attempt blocked — host=${redactUrl(url)} reason=disallowed-scheme:${parsed.protocol}`,
    );
    return false;
  }

  const result = await validateUrl(url);
  if (!result.valid) {
    console.warn(
      `SSRF attempt blocked — host=${redactUrl(url)} reason=${result.reason ?? "unknown"}`,
    );
    return false;
  }

  return true;
}
