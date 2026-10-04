import { describe, it, expect } from "vitest";
import { composeSections } from "../src/composer.js";
import type { ConnectorResult } from "@wpi/connectors";

describe("composeSections with connectors", () => {
  it("merges connector results into unavailable", () => {
    const connectorResults: ConnectorResult[] = [
      {
        ok: false,
        connector: "psi",
        unavailable_reason_key: "unavailable.connector.psi",
      },
    ];

    const result = composeSections([], connectorResults, {
      maxPages: 1,
      comparisons: 0,
      aiVisibilityPanel: false,
      actionBoardCap: 5,
    });

    expect(result.unavailable).toContainEqual({
      section: "performance",
      reason_key: "unavailable.connector.psi",
    });
  });

  it("notes connector availability", () => {
    const connectorResults: ConnectorResult[] = [
      {
        ok: true,
        connector: "psi",
        data: {
          psi: {
            core_web_vitals: { lcp: 2500, fid: 100, cls: 0.1 },
            opportunities: [],
          },
        },
      },
    ];

    const result = composeSections([], connectorResults, {
      maxPages: 1,
      comparisons: 0,
      aiVisibilityPanel: false,
      actionBoardCap: 5,
    });

    expect(result.summary_bullets).toContain("report.summary.performance");
  });
});
