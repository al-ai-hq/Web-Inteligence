// services/connectors/tests/psi.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PsiConnector } from "../src/psi/index.js";

describe("PsiConnector", () => {
  beforeEach(() => {
    vi.stubEnv("WPI_PSI_API_KEY", "test-key");
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns unavailable when API key is missing", async () => {
    vi.stubEnv("WPI_PSI_API_KEY", undefined);
    const connector = new PsiConnector();
    const result = await connector.run("https://example.com", {
      locale: "en",
      tier: "free",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.unavailable_reason_key).toBe(
        "unavailable.connector.psi.missing_api_key",
      );
    }
  });

  it("fetches PSI data successfully", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        lighthouseResult: {
          audits: {
            "largest-contentful-paint": { numericValue: 2500 },
            "max-potential-fid": { numericValue: 100 },
            "cumulative-layout-shift": { numericValue: 0.1 },
          },
        },
      }),
    } as Response);

    const connector = new PsiConnector();
    const result = await connector.run("https://example.com", {
      locale: "en",
      tier: "free",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.psi).toBeDefined();
      expect(result.data.psi?.core_web_vitals.lcp).toBe(2500);
    }
  });

  it("handles API error gracefully", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    const connector = new PsiConnector();
    const result = await connector.run("https://example.com", {
      locale: "en",
      tier: "free",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.unavailable_reason_key).toBe(
        "unavailable.connector.psi.api_error",
      );
    }
  });
});
