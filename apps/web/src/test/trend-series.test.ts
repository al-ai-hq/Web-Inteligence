import { describe, expect, it } from "vitest";
import { buildTrendSeries } from "../app/[locale]/_components/trend-series";

describe("buildTrendSeries", () => {
  it("extracts scores from completed audits", () => {
    const records = [
      {
        created_at: "2026-10-01T00:00:00Z",
        report: { score: { presence_readiness: 65 } },
      },
      {
        created_at: "2026-10-05T00:00:00Z",
        report: { score: { presence_readiness: 72 } },
      },
    ];
    const points = buildTrendSeries(records);
    expect(points).toEqual([
      { date: "2026-10-01T00:00:00Z", score: 65 },
      { date: "2026-10-05T00:00:00Z", score: 72 },
    ]);
  });

  it("skips audits with null score", () => {
    const records = [
      { created_at: "2026-10-01T00:00:00Z", report: null },
      {
        created_at: "2026-10-05T00:00:00Z",
        report: { score: { presence_readiness: 72 } },
      },
    ];
    const points = buildTrendSeries(records);
    expect(points).toHaveLength(1);
    const first = points[0];
    if (!first) throw new Error("expected one point");
    expect(first.score).toBe(72);
  });

  it("sorts ascending by date from newest-first input", () => {
    const records = [
      {
        created_at: "2026-10-10T00:00:00Z",
        report: { score: { presence_readiness: 80 } },
      },
      {
        created_at: "2026-10-01T00:00:00Z",
        report: { score: { presence_readiness: 60 } },
      },
    ];
    const points = buildTrendSeries(records);
    const first = points[0];
    const second = points[1];
    if (!first || !second) throw new Error("expected two points");
    expect(first.date).toBe("2026-10-01T00:00:00Z");
    expect(second.date).toBe("2026-10-10T00:00:00Z");
  });
});
