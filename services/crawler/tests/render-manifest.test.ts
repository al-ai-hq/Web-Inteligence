import { describe, it, expect } from "vitest";
import {
  shouldRender,
  createManifest,
  addToManifest,
  serializeManifest,
  parseManifest,
} from "../src/render-manifest.js";

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------
describe("render-manifest", () => {
  describe("shouldRender", () => {
    it("returns true when textBytes < threshold", () => {
      expect(shouldRender(100, 500)).toBe(true);
    });

    it("returns false when textBytes >= threshold", () => {
      expect(shouldRender(600, 500)).toBe(false);
    });

    it("returns true for 0 bytes", () => {
      expect(shouldRender(0, 500)).toBe(true);
    });

    it("returns false at exact threshold (boundary)", () => {
      expect(shouldRender(500, 500)).toBe(false);
    });
  });

  describe("createManifest", () => {
    it("creates empty manifest with threshold", () => {
      const manifest = createManifest(500);
      expect(manifest).toEqual({ entries: [], threshold: 500 });
    });
  });

  describe("addToManifest", () => {
    it("adds entry when shouldRender is true", () => {
      const manifest = createManifest(500);
      const updated = addToManifest(manifest, "https://example.com", 100);
      expect(updated.entries).toHaveLength(1);
      expect(updated.entries[0]).toEqual({
        url: "https://example.com",
        textByteLength: 100,
      });
    });

    it("does not add entry when shouldRender is false", () => {
      const manifest = createManifest(500);
      const updated = addToManifest(manifest, "https://example.com", 600);
      expect(updated.entries).toHaveLength(0);
    });

    it("is immutable (original manifest unchanged)", () => {
      const manifest = createManifest(500);
      const updated = addToManifest(manifest, "https://example.com", 100);
      expect(manifest.entries).toHaveLength(0);
      expect(updated.entries).toHaveLength(1);
    });

    it("allows multiple entries to be added", () => {
      const manifest = createManifest(500);
      const m1 = addToManifest(manifest, "https://example.com/1", 100);
      const m2 = addToManifest(m1, "https://example.com/2", 200);
      const m3 = addToManifest(m2, "https://example.com/3", 300);
      expect(m3.entries).toHaveLength(3);
      expect(m3.entries[0]?.url).toBe("https://example.com/1");
      expect(m3.entries[1]?.url).toBe("https://example.com/2");
      expect(m3.entries[2]?.url).toBe("https://example.com/3");
    });
  });

  describe("serializeManifest", () => {
    it("produces valid JSON", () => {
      const manifest = createManifest(500);
      const json = serializeManifest(manifest);
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it("produces formatted JSON with indentation", () => {
      const manifest = createManifest(500);
      const json = serializeManifest(manifest);
      expect(json).toContain("\n");
      expect(json).toContain("  ");
    });
  });

  describe("parseManifest", () => {
    it("roundtrips correctly (serialize then parse)", () => {
      const manifest = createManifest(500);
      const m1 = addToManifest(manifest, "https://example.com", 100);
      const json = serializeManifest(m1);
      const parsed = parseManifest(json);
      expect(parsed).toEqual(m1);
    });

    it("throws on invalid JSON", () => {
      expect(() => parseManifest("not valid json")).toThrow("Invalid render manifest format");
    });

    it("throws on missing fields", () => {
      expect(() => parseManifest("{}")).toThrow("Invalid render manifest format");
    });

    it("throws when entries is not an array", () => {
      expect(() => parseManifest('{"entries": "not array", "threshold": 500}')).toThrow(
        "Invalid render manifest format",
      );
    });

    it("throws when threshold is not a number", () => {
      expect(() => parseManifest('{"entries": [], "threshold": "500"}')).toThrow(
        "Invalid render manifest format",
      );
    });
  });
});
