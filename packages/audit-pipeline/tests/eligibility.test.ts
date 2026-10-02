import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TIER_SCOPES, decideTier, loadTierScopes } from "../src/eligibility.js";

describe("decideTier", () => {
  it("gives rich when rich quota unused, then reduced, then preview", () => {
    expect(decideTier({ rich_count: 0, reduced_count: 5, preview_count: 5 })).toBe("rich");
    expect(decideTier({ rich_count: 1, reduced_count: 0, preview_count: 5 })).toBe("reduced");
    expect(decideTier({ rich_count: 1, reduced_count: 1, preview_count: 0 })).toBe("preview");
    expect(decideTier({ rich_count: 1, reduced_count: 1, preview_count: 9 })).toBe("preview");
  });
});

describe("TIER_SCOPES", () => {
  it("matches config/anonymous-eligibility.yaml values", () => {
    expect(TIER_SCOPES.rich).toEqual({
      maxPages: 20,
      actionBoardCap: 12,
      comparisons: 1,
      roadmap: true,
      aiVisibilityPanel: true,
    });
    expect(TIER_SCOPES.reduced).toEqual({
      maxPages: 10,
      actionBoardCap: 12,
      comparisons: 0,
      roadmap: false,
      aiVisibilityPanel: false,
    });
    expect(TIER_SCOPES.preview).toEqual({
      maxPages: 1,
      actionBoardCap: 3,
      comparisons: 0,
      roadmap: false,
      aiVisibilityPanel: false,
    });
  });
});

describe("loadTierScopes", () => {
  it("maps snake_case YAML scope to TierScope", () => {
    const dir = mkdtempSync(join(tmpdir(), "wpi-elig-"));
    const configPath = join(dir, "anonymous-eligibility.yaml");
    writeFileSync(
      configPath,
      [
        "version: \"0.1.0-draft\"",
        "tiers:",
        "  rich:",
        "    scope:",
        "      max_representative_pages: 20",
        "      comparisons: 1",
        "      ai_visibility_panel: \"config/prompt-panels/free-panel.yaml\"",
        "      action_board: { min: 8, max: 12 }",
        "      preliminary_roadmap: true",
        "  reduced:",
        "    scope:",
        "      max_representative_pages: 10",
        "      comparisons: 0",
        "      ai_visibility_panel: false",
        "      action_board: { min: 8, max: 12 }",
        "      preliminary_roadmap: false",
        "  preview:",
        "    scope:",
        "      max_representative_pages: 1",
        "      comparisons: 0",
        "      ai_visibility_panel: false",
        "      action_board: { min: 0, max: 3 }",
        "      preliminary_roadmap: false",
        "",
      ].join("\n"),
      "utf8",
    );
    const scopes = loadTierScopes(configPath);
    expect(scopes.rich).toEqual({
      maxPages: 20,
      actionBoardCap: 12,
      comparisons: 1,
      roadmap: true,
      aiVisibilityPanel: true,
    });
    expect(scopes.preview).toEqual({
      maxPages: 1,
      actionBoardCap: 3,
      comparisons: 0,
      roadmap: false,
      aiVisibilityPanel: false,
    });
  });

  it("throws when a tier scope is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "wpi-elig-"));
    const configPath = join(dir, "broken.yaml");
    writeFileSync(configPath, "tiers:\n  rich:\n    scope:\n      max_representative_pages: 20\n", "utf8");
    expect(() => loadTierScopes(configPath)).toThrow(/reduced/);
  });
});
