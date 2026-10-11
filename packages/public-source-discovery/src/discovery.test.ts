import { describe, expect, it } from "vitest";
import { discoverPublicSources } from "./discovery.js";

describe("discoverPublicSources", () => {
  it("returns discovered profiles for a business", async () => {
    const profiles = await discoverPublicSources({
      businessName: "Example Business",
      siteUrl: "https://example.com",
      location: { locality: "Anytown", region: "CA" },
    });

    expect(profiles.length).toBeGreaterThan(0);
    expect(profiles[0]).toHaveProperty("platform");
    expect(profiles[0]).toHaveProperty("url");
  });

  it("returns empty array for empty business name", async () => {
    const profiles = await discoverPublicSources({
      businessName: "",
      siteUrl: "https://example.com",
    });

    expect(profiles).toEqual([]);
  });
});
