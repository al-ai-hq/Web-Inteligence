import { describe, expect, it } from "vitest";
import { generateProfileUrls } from "./platforms.js";

describe("generateProfileUrls", () => {
  it("generates Google Maps search URL from business name and location", () => {
    const urls = generateProfileUrls("Example Business", "https://example.com", {
      locality: "Anytown",
      region: "CA",
    });
    expect(urls).toContainEqual(
      expect.objectContaining({ platform: "google", url: expect.stringContaining("google.com/maps") }),
    );
  });

  it("generates Yelp search URL from business name and location", () => {
    const urls = generateProfileUrls("Example Business", "https://example.com", {
      locality: "Anytown",
      region: "CA",
    });
    expect(urls).toContainEqual(
      expect.objectContaining({ platform: "yelp", url: expect.stringContaining("yelp.com") }),
    );
  });

  it("generates Facebook search URL from business name", () => {
    const urls = generateProfileUrls("Example Business", "https://example.com");
    expect(urls).toContainEqual(
      expect.objectContaining({ platform: "facebook", url: expect.stringContaining("facebook.com") }),
    );
  });

  it("returns empty array for empty business name", () => {
    const urls = generateProfileUrls("", "https://example.com");
    expect(urls).toEqual([]);
  });
});
