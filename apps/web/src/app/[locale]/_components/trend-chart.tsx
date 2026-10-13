import { useTranslations } from "next-intl";
import { buildTrendSeries, type TrendPoint } from "./trend-series";

const WIDTH = 560;
const HEIGHT = 180;
const PAD_X = 32;
const PAD_Y = 16;
const SCORE_LINE_COLOR = "#2563eb";

interface TrendRecord {
  created_at: string;
  report: { score: { presence_readiness: number | null } | null } | null;
}

export function TrendChart({
  records,
  locale,
}: {
  records: TrendRecord[];
  locale: string;
}) {
  const t = useTranslations("dashboard");
  const points = buildTrendSeries(records);

  if (points.length === 0) {
    return null;
  }

  const stepX =
    points.length > 1 ? (WIDTH - PAD_X * 2) / (points.length - 1) : 0;

  const pathD = points
    .map((point, i) => {
      const x = PAD_X + i * stepX;
      const y = HEIGHT - PAD_Y - (point.score / 100) * (HEIGHT - PAD_Y * 2);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  });

  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full max-w-xl"
      aria-label={t("title")}
    >
      {[0, 50, 100].map((value) => {
        const y = HEIGHT - PAD_Y - (value / 100) * (HEIGHT - PAD_Y * 2);
        return (
          <g key={value}>
            <line
              x1={PAD_X}
              y1={y}
              x2={WIDTH - PAD_X}
              y2={y}
              stroke="#e5e5e5"
              strokeWidth={1}
            />
            <text x={4} y={y + 4} className="fill-neutral-400" fontSize={10}>
              {value}
            </text>
          </g>
        );
      })}
      <path d={pathD} fill="none" stroke={SCORE_LINE_COLOR} strokeWidth={2} />
      {points.map((point, i) => {
        const x = PAD_X + i * stepX;
        const y =
          HEIGHT - PAD_Y - (point.score / 100) * (HEIGHT - PAD_Y * 2);
        return (
          <circle key={point.date} cx={x} cy={y} r={3} fill={SCORE_LINE_COLOR}>
            <title>
              {dateFormatter.format(new Date(point.date))}: {point.score}
            </title>
          </circle>
        );
      })}
    </svg>
  );
}
