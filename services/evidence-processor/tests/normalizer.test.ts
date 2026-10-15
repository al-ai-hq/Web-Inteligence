import { describe, it, expect } from "vitest";
import { normalizeEvidence } from "../src/normalizer.js";
import type { RawEvidence, NormalizeOptions } from "../src/normalizer.js";

function makeRawEvidence(overrides: Partial<RawEvidence> = {}): RawEvidence {
  return {
    url: "https://example.com/page",
    finalUrl: "https://example.com/final",
    statusCode: 200,
    contentHash: "abc123def456",
    redirectChain: ["https://example.com/old"],
    contentType: "text/html; charset=utf-8",
    headings: [{ level: 1, text: "Title" }],
    links: ["https://example.com/link1"],
    language: "en",
    direction: "ltr",
    structuredData: [{ "@type": "WebPage" }],
    textByteLength: 1024,
    fetchedAt: "2025-01-15T12:00:00.000Z",
    ...overrides,
  };
}

function makeOptions(overrides: Partial<NormalizeOptions> = {}): NormalizeOptions {
  return {
    auditId: "audit-001",
    injectionSuspected: false,
    ...overrides,
  };
}

describe("normalizeEvidence", () => {
  describe("basic field mapping (camelCase → snake_case)", () => {
    it("maps all fields correctly", () => {
      const raw = makeRawEvidence();
      const opts = makeOptions();
      const result = normalizeEvidence(raw, opts);

      expect(result.url).toBe("https://example.com/page");
      expect(result.final_url).toBe("https://example.com/final");
      expect(result.status_code).toBe(200);
      expect(result.content_hash).toBe("sha256:abc123def456");
      expect(result.content_type).toBe("text/html; charset=utf-8");
      expect(result.fetched_at).toBe("2025-01-15T12:00:00.000Z");
      expect(result.redirect_chain).toEqual(["https://example.com/old"]);
      expect(result.headings).toEqual([{ level: 1, text: "Title" }]);
      expect(result.links).toEqual(["https://example.com/link1"]);
      expect(result.language).toBe("en");
      expect(result.direction).toBe("ltr");
      expect(result.structured_data).toEqual([{ "@type": "WebPage" }]);
      expect(result.text_byte_length).toBe(1024);
    });

    it("preserves empty arrays", () => {
      const raw = makeRawEvidence({
        redirectChain: [],
        links: [],
        headings: [],
        structuredData: [],
      });
      const result = normalizeEvidence(raw, makeOptions());

      expect(result.redirect_chain).toEqual([]);
      expect(result.links).toEqual([]);
      expect(result.headings).toEqual([]);
      expect(result.structured_data).toEqual([]);
    });
  });

  describe("content_hash prefix", () => {
    it("adds sha256: prefix when missing", () => {
      const raw = makeRawEvidence({ contentHash: "abc123" });
      const result = normalizeEvidence(raw, makeOptions());
      expect(result.content_hash).toBe("sha256:abc123");
    });

    it("does not double-prefix when sha256: already present", () => {
      const raw = makeRawEvidence({ contentHash: "sha256:abc123" });
      const result = normalizeEvidence(raw, makeOptions());
      expect(result.content_hash).toBe("sha256:abc123");
    });
  });

  describe("defaults", () => {
    it("defaults contentType to text/html when undefined", () => {
      const raw = makeRawEvidence({ contentType: undefined });
      const result = normalizeEvidence(raw, makeOptions());
      expect(result.content_type).toBe("text/html");
    });

    it("defaults raw_expires_at to 24h from fetchedAt when not provided", () => {
      const raw = makeRawEvidence({ fetchedAt: "2025-01-15T12:00:00.000Z" });
      const opts = makeOptions(); // no rawExpiresAt
      const result = normalizeEvidence(raw, opts);
      expect(result.raw_expires_at).toBe("2025-01-16T12:00:00.000Z");
    });

    it("sets headers to empty object", () => {
      const result = normalizeEvidence(makeRawEvidence(), makeOptions());
      expect(result.headers).toEqual({});
    });

    it("sets kind to http_response", () => {
      const result = normalizeEvidence(makeRawEvidence(), makeOptions());
      expect(result.kind).toBe("http_response");
    });

    it("sets immutable to true", () => {
      const result = normalizeEvidence(makeRawEvidence(), makeOptions());
      expect(result.immutable).toBe(true);
    });
  });

  describe("options", () => {
    it("propagates auditId", () => {
      const result = normalizeEvidence(makeRawEvidence(), makeOptions({ auditId: "audit-xyz" }));
      expect(result.audit_id).toBe("audit-xyz");
    });

    it("propagates injectionSuspected=true", () => {
      const result = normalizeEvidence(
        makeRawEvidence(),
        makeOptions({ injectionSuspected: true }),
      );
      expect(result.injection_suspected).toBe(true);
    });

    it("propagates injectionSuspected=false", () => {
      const result = normalizeEvidence(
        makeRawEvidence(),
        makeOptions({ injectionSuspected: false }),
      );
      expect(result.injection_suspected).toBe(false);
    });

    it("uses custom rawExpiresAt when provided", () => {
      const result = normalizeEvidence(
        makeRawEvidence(),
        makeOptions({ rawExpiresAt: "2025-06-01T00:00:00.000Z" }),
      );
      expect(result.raw_expires_at).toBe("2025-06-01T00:00:00.000Z");
    });
  });

  describe("body serialization", () => {
    it("body is JSON string of extracted content fields", () => {
      const raw = makeRawEvidence({
        headings: [{ level: 1, text: "H1" }],
        links: ["https://a.com"],
        structuredData: [{ "@type": "Article" }],
        textByteLength: 512,
      });
      const result = normalizeEvidence(raw, makeOptions());
      const parsed = JSON.parse(result.body);

      expect(parsed).toEqual({
        headings: [{ level: 1, text: "H1" }],
        links: ["https://a.com"],
        structuredData: [{ "@type": "Article" }],
        textByteLength: 512,
      });
    });

    it("body is parseable back to original structure", () => {
      const raw = makeRawEvidence();
      const result = normalizeEvidence(raw, makeOptions());
      const parsed = JSON.parse(result.body);

      expect(parsed.headings).toEqual(raw.headings);
      expect(parsed.links).toEqual(raw.links);
      expect(parsed.structuredData).toEqual(raw.structuredData);
      expect(parsed.textByteLength).toBe(raw.textByteLength);
    });

    it("body does not include non-content fields", () => {
      const raw = makeRawEvidence();
      const result = normalizeEvidence(raw, makeOptions());
      const parsed = JSON.parse(result.body);

      expect(parsed.url).toBeUndefined();
      expect(parsed.statusCode).toBeUndefined();
      expect(parsed.contentHash).toBeUndefined();
    });
  });

  describe("optional fields", () => {
    it("passes through undefined language", () => {
      const raw = makeRawEvidence({ language: undefined });
      const result = normalizeEvidence(raw, makeOptions());
      expect(result.language).toBeUndefined();
    });

    it("passes through undefined direction", () => {
      const raw = makeRawEvidence({ direction: undefined });
      const result = normalizeEvidence(raw, makeOptions());
      expect(result.direction).toBeUndefined();
    });
  });
});
