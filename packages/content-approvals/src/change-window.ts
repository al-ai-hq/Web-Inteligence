export interface ChangeWindow {
  project_id: string;
  day_of_week: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  start_time: string;
  end_time: string;
  timezone: string;
}

export function isWithinChangeWindow(
  riskTier: number,
  window: ChangeWindow,
  now: Date
): boolean {
  if (riskTier < 3) return true;

  const day = now.getUTCDay();
  if (day !== window.day_of_week) return false;

  const hours = now.getUTCHours();
  const minutes = now.getUTCMinutes();
  const currentTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  return currentTime >= window.start_time && currentTime <= window.end_time;
}
