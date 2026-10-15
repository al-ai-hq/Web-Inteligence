import { createHash } from "node:crypto";
import type { PageEvidence } from "./evidence.js";
import type { Lineage } from "./types.js";
import { IntegrityError } from "./types.js";

export { IntegrityError };

// ─── Content Hash ─────────────────────────────────────────────────────────────

/**
 * Compute a SHA-256 content hash over sorted evidence IDs + methodology version.
 * Format: "sha256:<hex>"
 */
export function computeContentHash(evidenceIds: string[], methodologyVersion: string): string {
  const sorted = [...evidenceIds].sort();
  const payload = sorted.join(",") + "|" + methodologyVersion;
  const hex = createHash("sha256").update(payload).digest("hex");
  return `sha256:${hex}`;
}

// ─── Lineage Attachment ───────────────────────────────────────────────────────

/**
 * Build a complete Lineage object for a rule result.
 */
export function attachLineage(
  evidenceIds: string[],
  methodologyVersion: string,
  fidelityLabel: string,
): Lineage {
  return {
    parent_ids: [...evidenceIds],
    fidelity_label: fidelityLabel,
    content_hash: computeContentHash(evidenceIds, methodologyVersion),
    method: "deterministic",
    validation_state: "validated",
  };
}

// ─── Freshness Validation ─────────────────────────────────────────────────────

/**
 * Check whether a single evidence item is fresh (not stale).
 * @returns true if the evidence is within the max age, false if stale.
 */
export function checkFreshness(fetchedAt: string, maxAgeDays: number, now?: Date): boolean {
  const reference = now ?? new Date();
  const fetched = new Date(fetchedAt);
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const ageMs = reference.getTime() - fetched.getTime();
  return ageMs <= maxAgeMs;
}

/**
 * Find all evidence IDs that are stale (fetched_at older than maxAgeDays).
 */
export function findStaleEvidence(pages: PageEvidence[], maxAgeDays: number, now?: Date): string[] {
  const stale: string[] = [];
  for (const page of pages) {
    if (!checkFreshness(page.fetched_at, maxAgeDays, now)) {
      stale.push(page.evidence_id);
    }
  }
  return stale;
}

// ─── Integrity Guard ──────────────────────────────────────────────────────────

/**
 * Valid SHA-256 hash format: "sha256:" followed by exactly 64 lowercase hex chars.
 */
const VALID_HASH_RE = /^sha256:[0-9a-f]{64}$/;

/**
 * Verify that all page evidence has valid content_hash format.
 * Throws IntegrityError if any hash is invalid (wrong format, wrong length, non-hex).
 */
export function verifyEvidenceHashes(pages: PageEvidence[]): void {
  for (const page of pages) {
    if (!VALID_HASH_RE.test(page.content_hash)) {
      throw new IntegrityError(
        `Invalid content_hash for evidence "${page.evidence_id}": "${page.content_hash}"`,
      );
    }
  }
}

// ─── Fidelity Mapping ─────────────────────────────────────────────────────────

const FIDELITY_MAP: Record<string, string> = {
  deterministic: "verified",
  assessed: "inferred",
  attested: "client_stated",
  observed: "verified",
};

/**
 * Map an evaluation method to its evidence state label.
 */
export function mapFidelity(method: string): string {
  return FIDELITY_MAP[method] ?? "not_verified";
}
