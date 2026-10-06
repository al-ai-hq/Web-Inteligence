import { describe, it, expect } from "vitest";
import type { PageEvidence } from "../src/evidence.js";
import {
  computeContentHash,
  attachLineage,
  checkFreshness,
  findStaleEvidence,
  verifyEvidenceHashes,
  mapFidelity,
  IntegrityError,
} from "../src/integrity.js";

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function makePageEvidence(overrides: Partial<PageEvidence> = {}): PageEvidence {
  return {
    evidence_id: "ev-001",
    url: "https://example.com/",
    final_url: "https://example.com/",
    status_code: 200,
    content_type: "text/html",
    content_hash: "sha256:" + "a".repeat(64),
    fetched_at: new Date().toISOString(),
    render: { rendered: true },
    title: "Example",
    meta_description: "desc",
    canonical: null,
    lang: "en",
    viewport_meta: "width=device-width",
    headings: [{ level: 1, text: "Hello" }],
    word_count: 500,
    main_content_bytes: 3000,
    structured_data: [],
    links: [],
    robots_directive: "index",
    ...overrides,
  };
}

// ─── computeContentHash ──────────────────────────────────────────────────────

describe("computeContentHash", () => {
  it("returns sha256:<hex> over sorted evidence IDs + version", () => {
    const hash = computeContentHash(["ev-b", "ev-a"], "1.0.0");
    expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("produces the same hash regardless of input order", () => {
    const h1 = computeContentHash(["ev-c", "ev-a", "ev-b"], "1.0.0");
    const h2 = computeContentHash(["ev-a", "ev-b", "ev-c"], "1.0.0");
    expect(h1).toBe(h2);
  });

  it("produces different hashes for different versions", () => {
    const h1 = computeContentHash(["ev-a"], "1.0.0");
    const h2 = computeContentHash(["ev-a"], "2.0.0");
    expect(h1).not.toBe(h2);
  });

  it("produces different hashes for different evidence sets", () => {
    const h1 = computeContentHash(["ev-a"], "1.0.0");
    const h2 = computeContentHash(["ev-b"], "1.0.0");
    expect(h1).not.toBe(h2);
  });

  it("handles empty evidence IDs", () => {
    const hash = computeContentHash([], "1.0.0");
    expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

// ─── attachLineage ───────────────────────────────────────────────────────────

describe("attachLineage", () => {
  it("returns a complete Lineage object", () => {
    const lineage = attachLineage(["ev-a", "ev-b"], "1.0.0", "computed");
    expect(lineage).toEqual({
      parent_ids: ["ev-a", "ev-b"],
      fidelity_label: "computed",
      content_hash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
      method: "deterministic",
      validation_state: "validated",
    });
  });

  it("sets parent_ids to the evidence IDs", () => {
    const lineage = attachLineage(["ev-x"], "1.0.0", "assessed");
    expect(lineage.parent_ids).toEqual(["ev-x"]);
  });

  it("preserves the fidelity_label", () => {
    const lineage = attachLineage(["ev-a"], "1.0.0", "assessed");
    expect(lineage.fidelity_label).toBe("assessed");
  });

  it("computes content_hash matching computeContentHash", () => {
    const ids = ["ev-a", "ev-b"];
    const version = "2.0.0";
    const lineage = attachLineage(ids, version, "computed");
    const expected = computeContentHash(ids, version);
    expect(lineage.content_hash).toBe(expected);
  });
});

// ─── checkFreshness ──────────────────────────────────────────────────────────

describe("checkFreshness", () => {
  it("returns true when evidence is within max age", () => {
    const now = new Date("2025-01-10T12:00:00Z");
    const fetchedAt = "2025-01-08T12:00:00Z"; // 2 days ago
    expect(checkFreshness(fetchedAt, 7, now)).toBe(true);
  });

  it("returns false when evidence is older than max age", () => {
    const now = new Date("2025-01-20T12:00:00Z");
    const fetchedAt = "2025-01-01T12:00:00Z"; // 19 days ago
    expect(checkFreshness(fetchedAt, 7, now)).toBe(false);
  });

  it("returns true when evidence is exactly at the boundary", () => {
    const now = new Date("2025-01-08T12:00:00Z");
    const fetchedAt = "2025-01-01T12:00:00Z"; // exactly 7 days
    expect(checkFreshness(fetchedAt, 7, now)).toBe(true);
  });

  it("returns false when evidence is one second past the boundary", () => {
    const now = new Date("2025-01-08T12:00:01Z");
    const fetchedAt = "2025-01-01T12:00:00Z"; // 7 days + 1 second
    expect(checkFreshness(fetchedAt, 7, now)).toBe(false);
  });

  it("defaults to current time when now is not provided", () => {
    // Evidence fetched just now should be fresh
    const fetchedAt = new Date().toISOString();
    expect(checkFreshness(fetchedAt, 7)).toBe(true);
  });

  it("returns false for very old evidence with default max age", () => {
    const fetchedAt = "2020-01-01T00:00:00Z";
    expect(checkFreshness(fetchedAt, 7)).toBe(false);
  });
});

// ─── findStaleEvidence ───────────────────────────────────────────────────────

describe("findStaleEvidence", () => {
  it("returns empty array when all evidence is fresh", () => {
    const now = new Date("2025-01-10T12:00:00Z");
    const pages = [
      makePageEvidence({ evidence_id: "ev-1", fetched_at: "2025-01-09T12:00:00Z" }),
      makePageEvidence({ evidence_id: "ev-2", fetched_at: "2025-01-08T12:00:00Z" }),
    ];
    expect(findStaleEvidence(pages, 7, now)).toEqual([]);
  });

  it("returns evidence IDs that are stale", () => {
    const now = new Date("2025-01-20T12:00:00Z");
    const pages = [
      makePageEvidence({ evidence_id: "ev-fresh", fetched_at: "2025-01-19T12:00:00Z" }),
      makePageEvidence({ evidence_id: "ev-stale", fetched_at: "2025-01-01T12:00:00Z" }),
    ];
    expect(findStaleEvidence(pages, 7, now)).toEqual(["ev-stale"]);
  });

  it("returns multiple stale evidence IDs", () => {
    const now = new Date("2025-02-01T12:00:00Z");
    const pages = [
      makePageEvidence({ evidence_id: "ev-old1", fetched_at: "2025-01-01T12:00:00Z" }),
      makePageEvidence({ evidence_id: "ev-old2", fetched_at: "2025-01-02T12:00:00Z" }),
      makePageEvidence({ evidence_id: "ev-new", fetched_at: "2025-01-30T12:00:00Z" }),
    ];
    const stale = findStaleEvidence(pages, 7, now);
    expect(stale).toEqual(["ev-old1", "ev-old2"]);
  });

  it("returns empty array for empty pages", () => {
    expect(findStaleEvidence([], 7)).toEqual([]);
  });
});

// ─── verifyEvidenceHashes ────────────────────────────────────────────────────

describe("verifyEvidenceHashes", () => {
  it("does not throw for valid SHA-256 hashes", () => {
    const pages = [
      makePageEvidence({ content_hash: "sha256:" + "a".repeat(64) }),
      makePageEvidence({ content_hash: "sha256:" + "0".repeat(64) }),
    ];
    expect(() => verifyEvidenceHashes(pages)).not.toThrow();
  });

  it("throws IntegrityError for hash without sha256: prefix", () => {
    const pages = [makePageEvidence({ content_hash: "a".repeat(64) })];
    expect(() => verifyEvidenceHashes(pages)).toThrow(IntegrityError);
  });

  it("throws IntegrityError for hash with wrong length", () => {
    const pages = [makePageEvidence({ content_hash: "sha256:abcdef" })];
    expect(() => verifyEvidenceHashes(pages)).toThrow(IntegrityError);
  });

  it("throws IntegrityError for hash with non-hex characters", () => {
    const pages = [makePageEvidence({ content_hash: "sha256:" + "g".repeat(64) })];
    expect(() => verifyEvidenceHashes(pages)).toThrow(IntegrityError);
  });

  it("throws IntegrityError with name 'IntegrityError'", () => {
    const pages = [makePageEvidence({ content_hash: "invalid" })];
    try {
      verifyEvidenceHashes(pages);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(IntegrityError);
      expect((err as Error).name).toBe("IntegrityError");
    }
  });

  it("throws on the first invalid hash encountered", () => {
    const pages = [
      makePageEvidence({ evidence_id: "ev-ok", content_hash: "sha256:" + "a".repeat(64) }),
      makePageEvidence({ evidence_id: "ev-bad", content_hash: "sha256:tooshort" }),
    ];
    expect(() => verifyEvidenceHashes(pages)).toThrow(IntegrityError);
  });

  it("does not throw for empty pages array", () => {
    expect(() => verifyEvidenceHashes([])).not.toThrow();
  });

  it("throws IntegrityError for empty string hash", () => {
    const pages = [makePageEvidence({ content_hash: "" })];
    expect(() => verifyEvidenceHashes(pages)).toThrow(IntegrityError);
  });
});

// ─── mapFidelity ─────────────────────────────────────────────────────────────

describe("mapFidelity", () => {
  it("maps 'deterministic' to 'verified'", () => {
    expect(mapFidelity("deterministic")).toBe("verified");
  });

  it("maps 'assessed' to 'inferred'", () => {
    expect(mapFidelity("assessed")).toBe("inferred");
  });

  it("maps 'attested' to 'client_stated'", () => {
    expect(mapFidelity("attested")).toBe("client_stated");
  });

  it("maps 'observed' to 'verified'", () => {
    expect(mapFidelity("observed")).toBe("verified");
  });

  it("maps unknown method to 'not_verified'", () => {
    expect(mapFidelity("unknown")).toBe("not_verified");
  });

  it("maps empty string to 'not_verified'", () => {
    expect(mapFidelity("")).toBe("not_verified");
  });
});

// ─── IntegrityError ──────────────────────────────────────────────────────────

describe("IntegrityError", () => {
  it("is an instance of Error", () => {
    const err = new IntegrityError("test");
    expect(err).toBeInstanceOf(Error);
  });

  it("has name 'IntegrityError'", () => {
    const err = new IntegrityError("test");
    expect(err.name).toBe("IntegrityError");
  });

  it("has the provided message", () => {
    const err = new IntegrityError("hash mismatch");
    expect(err.message).toBe("hash mismatch");
  });
});
