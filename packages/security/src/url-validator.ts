import { resolveDns } from "./dns-resolver.js";

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  pinnedIp?: string;
}

const ALLOWED_PORTS = [80, 443];
const METADATA_HOSTNAMES = ["metadata.google.internal", "metadata.internal"];

export async function validateUrl(url: string): Promise<ValidationResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, reason: "invalid URL format" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, reason: "scheme not allowed" };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, reason: "credentials not allowed" };
  }

  const port = parsed.port ? parseInt(parsed.port, 10) : parsed.protocol === "https:" ? 443 : 80;
  if (!ALLOWED_PORTS.includes(port)) {
    return { valid: false, reason: "port not allowed" };
  }

  if (METADATA_HOSTNAMES.includes(parsed.hostname)) {
    return { valid: false, reason: "metadata hostname blocked" };
  }

  if (parsed.hostname === "169.254.169.254") {
    return { valid: false, reason: "metadata IP blocked" };
  }

  try {
    const ips = await resolveDns(parsed.hostname);
    if (ips.length === 0) {
      return { valid: false, reason: "no public IP addresses" };
    }
    return { valid: true, pinnedIp: ips[0] };
  } catch (error) {
    return { valid: false, reason: `DNS resolution failed: ${error}` };
  }
}
