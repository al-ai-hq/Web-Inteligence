export interface ChangeWindow {
  project_id: string;
  day_of_week: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  start_time: string;
  end_time: string;
  timezone: string;
}

export function isWithinChangeWindow(riskTier: number, window: ChangeWindow, now: Date): boolean {
  if (riskTier < 3) return true;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: window.timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const weekdayPart = parts.find((p) => p.type === "weekday")?.value ?? "";
  const day = weekdayMap[weekdayPart] ?? 0;

  if (day !== window.day_of_week) return false;

  const hours = parts.find((p) => p.type === "hour")?.value ?? "0";
  const minutes = parts.find((p) => p.type === "minute")?.value ?? "0";
  const currentTime = `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;

  return currentTime >= window.start_time && currentTime <= window.end_time;
}
