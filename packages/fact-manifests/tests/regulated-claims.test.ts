import { describe, it, expect } from "vitest";
import { flagRegulatedClaim } from "../src/regulated-claims.js";

describe("flagRegulatedClaim", () => {
  it("flags health-related claims", () => {
    const result = flagRegulatedClaim({ statement: "This product can cure headaches" });
    expect(result.requires_review).toBe(true);
    expect(result.topic).toBe("health");
  });

  it("flags finance-related claims", () => {
    const result = flagRegulatedClaim({ statement: "Invest now for 10% return" });
    expect(result.requires_review).toBe(true);
    expect(result.topic).toBe("finance");
  });

  it("flags legal-related claims", () => {
    const result = flagRegulatedClaim({ statement: "Legal liability is limited by contract" });
    expect(result.requires_review).toBe(true);
    expect(result.topic).toBe("legal");
  });

  it("does not flag non-regulated claims", () => {
    const result = flagRegulatedClaim({ statement: "Our product is fast and reliable" });
    expect(result.requires_review).toBe(false);
    expect(result.topic).toBeNull();
  });
});
