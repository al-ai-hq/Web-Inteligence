import { describe, expect, test } from "vitest";
import { loadRecommendationConfig } from "../src/recommendation-config.js";

describe("loadRecommendationConfig", () => {
  test("loads scoring thresholds, effort, and timeline defaults", () => {
    const config = loadRecommendationConfig();
    expect(config.scoring.bandThresholds.quickWin).toBe(8);
    expect(config.scoring.effortByCategory.crawlability).toBeGreaterThanOrEqual(1);
    expect(config.scoring.effortByCategory.crawlability).toBeLessThanOrEqual(10);
    expect(config.scoring.timelineDefaultByCategory.on_page).toBeGreaterThanOrEqual(1);
    expect(config.scoring.timelineDefaultByCategory.on_page).toBeLessThanOrEqual(10);
  });

  test("covers every rule category in effort and timeline maps", () => {
    const { scoring } = loadRecommendationConfig();
    const categories = [
      "crawlability",
      "on_page",
      "structured_data",
      "aeo",
      "geo",
      "i18n_accessibility",
      "performance_security",
    ] as const;
    for (const category of categories) {
      expect(scoring.effortByCategory[category]).toBeTypeOf("number");
      expect(scoring.timelineDefaultByCategory[category]).toBeTypeOf("number");
    }
  });

  test("loads industry playbooks", () => {
    const config = loadRecommendationConfig();
    expect(config.playbooks.length).toBeGreaterThan(0);
    const saas = config.playbooks.find((p) => p.playbook_id === "saas");
    expect(saas).toBeDefined();
    expect(saas?.entries.length).toBeGreaterThan(0);
  });

  test("gives every playbook entry a null or string note key", () => {
    const config = loadRecommendationConfig();
    for (const playbook of config.playbooks) {
      for (const entry of playbook.entries) {
        expect(entry.note_key === null || typeof entry.note_key === "string").toBe(true);
      }
    }
  });

  test("never boosts above maxPlaybookBoost", () => {
    const config = loadRecommendationConfig();
    for (const playbook of config.playbooks) {
      for (const entry of playbook.entries) {
        expect(entry.boost).toBeLessThanOrEqual(config.scoring.maxPlaybookBoost);
      }
    }
  });
});
