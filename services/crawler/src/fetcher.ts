import { request, Agent } from "undici";
import { createHash } from "node:crypto";
import { validateUrl } from "@wpi/security";
import type { CrawlConfig } from "./config/schema.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface FetchResult {
  body: string;
  statusCode: number;
  finalUrl: string;
  contentHash: string; // SHA-256 hex digest
  redirectChain: string[]; // all URLs in redirect chain (including original)
  contentType?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MAX_REDIRECTS = 10;

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------
export async function fetchUrl(url: string, config: CrawlConfig): Promise<FetchResult> {
  // Validate the initial URL
  const initialValidation = await validateUrl(url);
  if (!initialValidation.valid) {
    throw new Error(`SSRF validation failed for ${url}: ${initialValidation.reason}`);
  }

  const redirectChain: string[] = [url];
  let currentUrl = url;
  let currentIp = initialValidation.pinnedIp;
  let redirectCount = 0;

  while (true) {
    // Connect to pinned IP to prevent DNS rebinding (TOCTOU fix)
    const targetUrl = currentIp ? rewriteToIp(currentUrl, currentIp) : currentUrl;
    const hostname = new URL(currentUrl).hostname;
    const dispatcher = currentIp ? new Agent({ connect: { servername: hostname } }) : undefined;
    try {
      const response = await request(targetUrl, {
        method: "GET",
        maxRedirections: 0,
        headersTimeout: config.request_timeout_seconds * 1000,
        bodyTimeout: config.request_timeout_seconds * 1000,
        ...(dispatcher ? { dispatcher } : {}),
      });

      const statusCode = response.statusCode;

      // Check if this is a redirect
      if (statusCode >= 300 && statusCode < 400) {
        const locationHeader = response.headers["location"];
        const location = Array.isArray(locationHeader) ? locationHeader[0] : locationHeader;

        if (!location) {
          throw new Error(`Redirect ${statusCode} without location header at ${currentUrl}`);
        }

        // Resolve relative redirect URL
        const redirectUrl = new URL(location, currentUrl).toString();

        // Re-validate the redirect target
        const redirectValidation = await validateUrl(redirectUrl);
        if (!redirectValidation.valid) {
          throw new Error(
            `SSRF validation failed for redirect to ${redirectUrl}: ${redirectValidation.reason}`,
          );
        }

        redirectCount++;
        if (redirectCount > MAX_REDIRECTS) {
          throw new Error(`Max redirects (${MAX_REDIRECTS}) exceeded. Last URL: ${currentUrl}`);
        }

        redirectChain.push(redirectUrl);
        currentUrl = redirectUrl;
        currentIp = redirectValidation.pinnedIp;
        continue;
      }

      // Non-redirect response — read the body
      const body = await response.body.text();

      // Check decompressed body size (use Buffer.byteLength for accurate byte count)
      const bodyByteLength = Buffer.byteLength(body, "utf-8");
      if (bodyByteLength > config.max_decompressed_size_bytes) {
        throw new Error(
          `Decompressed response too large: ${bodyByteLength} bytes exceeds limit of ${config.max_decompressed_size_bytes} bytes`,
        );
      }

      // Check response body size against max_response_size_bytes
      if (bodyByteLength > config.max_response_size_bytes) {
        throw new Error(
          `Response too large: ${bodyByteLength} bytes exceeds limit of ${config.max_response_size_bytes} bytes`,
        );
      }

      // Compute content hash
      const contentHash = createHash("sha256").update(body).digest("hex");

      // Extract content-type
      const contentTypeHeader = response.headers["content-type"];
      const contentType = Array.isArray(contentTypeHeader)
        ? contentTypeHeader[0]
        : contentTypeHeader;

      return {
        body,
        statusCode,
        finalUrl: currentUrl,
        contentHash,
        redirectChain,
        contentType: contentType ?? undefined,
      };
    } finally {
      await dispatcher?.close();
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Rewrite URL to connect to pinned IP instead of hostname.
 * This prevents DNS rebinding attacks by ensuring we connect to the IP
 * that was validated, not a potentially different IP resolved later.
 */
function rewriteToIp(url: string, ip: string): string {
  const parsed = new URL(url);
  // For IPv6, wrap in brackets
  const host = ip.includes(":") ? `[${ip}]` : ip;
  parsed.hostname = host;
  return parsed.toString();
}
