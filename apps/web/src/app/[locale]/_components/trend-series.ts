export interface TrendPoint {
  date: string;
  score: number;
}

interface TrendRecord {
  created_at: string;
  report: { score: { presence_readiness: number | null } | null } | null;
}

export function buildTrendSeries(records: TrendRecord[]): TrendPoint[] {
  return [...records]
    .filter(
      (record) => typeof record.report?.score?.presence_readiness === "number",
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((record) => ({
      date: record.created_at,
      score: record.report?.score?.presence_readiness as number,
    }));
}
