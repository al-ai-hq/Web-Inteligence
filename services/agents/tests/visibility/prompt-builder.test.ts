// services/agents/tests/visibility/prompt-builder.test.ts
import { describe, it, expect } from "vitest";
import { buildVisibilityPrompts } from "../../src/visibility/prompt-builder.js";
import type { VisibilityIntake } from "../../src/visibility/types.js";

const intake: VisibilityIntake = {
  brand_name: "Acme",
  offering_description: "cloud hosting",
  target_audience: "startups",
  market: "Saudi Arabia",
  category: "hosting",
  city: "Riyadh",
  use_case: "e-commerce",
  requirement: "high uptime",
  brand_domain: "acme.com",
  competitor_domains: ["rival.com"],
  brand_aliases: ["Acme Corp"],
  brand_facts: [],
};

describe("buildVisibilityPrompts", () => {
  it("fills free panel templates with intake values", () => {
    const templates = [
      { id: "free-discovery", panel: "free" as const, branded: false, text: "Which organizations provide {offering} for {audience} in {market}?", placeholders: ["offering", "audience", "market"] },
      { id: "free-branded-knowledge", panel: "free" as const, branded: true, text: "What does {brand} do, and who does it serve?", placeholders: ["brand"] },
    ];

    const result = buildVisibilityPrompts(intake, "free", templates);
    expect(result).toHaveLength(2);
    expect(result[0]!.final_prompt).toBe("Which organizations provide cloud hosting for startups in Saudi Arabia?");
    expect(result[0]!.prompt_id).toBe("free-discovery");
    expect(result[1]!.final_prompt).toBe("What does Acme do, and who does it serve?");
  });

  it("fills connected panel templates", () => {
    const templates = [
      { id: "panel-local", panel: "connected" as const, category: "local", branded: false, text: "Which providers offer {offering} near {city}?", placeholders: ["offering", "city"] },
    ];

    const result = buildVisibilityPrompts(intake, "connected", templates);
    expect(result).toHaveLength(1);
    expect(result[0]!.final_prompt).toBe("Which providers offer cloud hosting near Riyadh?");
  });

  it("throws when required placeholder is missing", () => {
    const noCity: VisibilityIntake = { ...intake, city: null };
    const templates = [
      { id: "panel-local", panel: "connected" as const, category: "local", branded: false, text: "Which providers offer {offering} near {city}?", placeholders: ["offering", "city"] },
    ];

    expect(() => buildVisibilityPrompts(noCity, "connected", templates)).toThrow("Missing value for placeholder: city");
  });

  it("throws when unresolved placeholder remains", () => {
    const templates = [
      { id: "test", panel: "free" as const, branded: false, text: "What about {unknown_placeholder}?", placeholders: ["unknown_placeholder"] },
    ];

    expect(() => buildVisibilityPrompts(intake, "free", templates)).toThrow("Missing value for placeholder: unknown_placeholder");
  });
});
