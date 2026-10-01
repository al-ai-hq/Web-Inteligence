import { describe, it, expect } from "vitest";
import { mergeEvidence } from "../src/merger.js";
import type { RenderedEvidence, MergedEvidenceObject } from "../src/merger.js";
import type { EvidenceObject } from "../src/normalizer.js";

function makeNormalized(overrides: Partial<EvidenceObject> = {}): EvidenceObject {
  return {
    audit_id: "audit-001",
    url: "https://example.com/page",
    kind: "http_response",
    fetched_at: "2025-01-15T12:00:00.000Z",
    content_hash: "sha256:abc123def456",
    content_type: "text/html",
    status_code: 200,
    headers: { "x-custom": "value" },
    body: JSON.stringify({ headings: [], links: [], structuredData: [], textByteLength: 512 }),
    raw_expires_at: "2025-01-16T12:00:00.000Z",
    injection_suspected: false,
    immutable: true,
    final_url: "https://example.com/final",
    redirect_chain: ["https://example.com/old"],
    headings: [{ level: 1, text: "Title" }],
    links: ["https://example.com/link1"],
    language: "en",
    direction: "ltr",
    structured_data: [{ "@type": "WebPage" }],
    text_byte_length: 1024,
    ...overrides,
  };
}

function makeRendered(overrides: Partial<RenderedEvidence> = {}): RenderedEvidence {
  return {
    url: "https://example.com/page",
    renderedAt: "2025-01-15T12:01:00.000Z",
    domSnapshot: "<html><body>Hello</body></html>",
    contentHash: "rendered_hash_789",
    renderDurationMs: 250,
    ...overrides,
  };
}

describe("mergeEvidence", () => {
  describe("no rendered evidence", () => {
    it("returns normalized object unchanged when rendered is undefined", () => {
      const normalized = makeNormalized();
      const result = mergeEvidence(normalized);

      expect(result).toEqual(normalized);
    });

    it("kind remains http_response", () => {
      const normalized = makeNormalized();
      const result = mergeEvidence(normalized);

      expect(result.kind).toBe("http_response");
    });

    it("no rendered_* fields present", () => {
      const normalized = makeNormalized();
      const result = mergeEvidence(normalized);

      expect(result).not.toHaveProperty("rendered_dom");
      expect(result).not.toHaveProperty("rendered_at");
      expect(result).not.toHaveProperty("render_content_hash");
      expect(result).not.toHaveProperty("render_duration_ms");
    });
  });

  describe("with rendered evidence", () => {
    it("kind changes to http_response_with_render", () => {
      const result = mergeEvidence(makeNormalized(), makeRendered());
      expect(result.kind).toBe("http_response_with_render");
    });

    it("rendered_dom contains the DOM snapshot", () => {
      const rendered = makeRendered({ domSnapshot: "<html><body>Test</body></html>" });
      const result = mergeEvidence(makeNormalized(), rendered);
      expect(result.rendered_dom).toBe("<html><body>Test</body></html>");
    });

    it("rendered_at contains the render timestamp", () => {
      const rendered = makeRendered({ renderedAt: "2025-01-15T12:01:00.000Z" });
      const result = mergeEvidence(makeNormalized(), rendered);
      expect(result.rendered_at).toBe("2025-01-15T12:01:00.000Z");
    });

    it("render_content_hash has sha256: prefix added", () => {
      const rendered = makeRendered({ contentHash: "abc123" });
      const result = mergeEvidence(makeNormalized(), rendered);
      expect(result.render_content_hash).toBe("sha256:abc123");
    });

    it("render_content_hash handles already-prefixed hash", () => {
      const rendered = makeRendered({ contentHash: "sha256:abc123" });
      const result = mergeEvidence(makeNormalized(), rendered);
      expect(result.render_content_hash).toBe("sha256:abc123");
    });

    it("render_duration_ms contains the duration", () => {
      const rendered = makeRendered({ renderDurationMs: 250 });
      const result = mergeEvidence(makeNormalized(), rendered);
      expect(result.render_duration_ms).toBe(250);
    });

    it("all original fields preserved from normalized", () => {
      const normalized = makeNormalized();
      const result = mergeEvidence(normalized, makeRendered());

      expect(result.audit_id).toBe(normalized.audit_id);
      expect(result.url).toBe(normalized.url);
      expect(result.fetched_at).toBe(normalized.fetched_at);
      expect(result.content_hash).toBe(normalized.content_hash);
      expect(result.content_type).toBe(normalized.content_type);
      expect(result.status_code).toBe(normalized.status_code);
      expect(result.headers).toEqual(normalized.headers);
      expect(result.body).toBe(normalized.body);
      expect(result.raw_expires_at).toBe(normalized.raw_expires_at);
      expect(result.injection_suspected).toBe(normalized.injection_suspected);
      expect(result.immutable).toBe(true);
      expect(result.final_url).toBe(normalized.final_url);
      expect(result.redirect_chain).toEqual(normalized.redirect_chain);
      expect(result.headings).toEqual(normalized.headings);
      expect(result.links).toEqual(normalized.links);
      expect(result.language).toBe(normalized.language);
      expect(result.direction).toBe(normalized.direction);
      expect(result.structured_data).toEqual(normalized.structured_data);
      expect(result.text_byte_length).toBe(normalized.text_byte_length);
    });
  });

  describe("edge cases", () => {
    it("empty domSnapshot string still merged", () => {
      const rendered = makeRendered({ domSnapshot: "" });
      const result = mergeEvidence(makeNormalized(), rendered);
      expect(result.rendered_dom).toBe("");
      expect(result.kind).toBe("http_response_with_render");
    });

    it("renderDurationMs of 0 still merged", () => {
      const rendered = makeRendered({ renderDurationMs: 0 });
      const result = mergeEvidence(makeNormalized(), rendered);
      expect(result.render_duration_ms).toBe(0);
      expect(result.kind).toBe("http_response_with_render");
    });

    it("original normalized object is not mutated", () => {
      const normalized = makeNormalized();
      const originalKind = normalized.kind;
      const originalKeys = Object.keys(normalized);

      mergeEvidence(normalized, makeRendered());

      expect(normalized.kind).toBe(originalKind);
      expect(Object.keys(normalized)).toEqual(originalKeys);
      expect(normalized).not.toHaveProperty("rendered_dom");
    });
  });
});
