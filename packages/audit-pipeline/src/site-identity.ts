import type { AuditStore } from "./audit-store.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Compare two targets as "the same site": scheme, port, path and tracking
 * parameters are ignored and `www.` is dropped, so re-auditing http://www.x/
 * still lines up with https://x/.
 */
export function normalizeDomain(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}

export type SiteStage = "new" | "growth" | "mature";

/**
 * Position the site by the age of its oldest completed audit on the same domain.
 *
 * A signed-in user's first audit of a domain has no history to judge against, so
 * it is reported as `new`; anonymous audits have no cross-audit history at all and
 * fall back to `growth`.
 */
export async function deriveSiteStage(
  store: AuditStore,
  userId: string | null,
  targetUrl: string,
  currentAuditId: string,
): Promise<SiteStage> {
  if (!userId) return "growth";

  const domain = normalizeDomain(targetUrl);
  if (!domain) return "growth";

  const records = await store.listByUser(userId);
  const prior = records
    .filter(
      (record) =>
        record.id !== currentAuditId &&
        record.status === "READY_COMPLETE" &&
        normalizeDomain(record.target_url) === domain,
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];

  if (!prior) return "new";

  const ageDays = (Date.now() - new Date(prior.created_at).getTime()) / DAY_MS;
  if (ageDays < 365) return "new";
  if (ageDays < 1095) return "growth";
  return "mature";
}
