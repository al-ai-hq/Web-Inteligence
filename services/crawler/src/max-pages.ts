export function resolveMaxPages(
  configMaxPages: number,
  envValue: string | undefined,
): number {
  if (envValue === undefined || envValue === "") {
    return configMaxPages;
  }
  const parsed = Number.parseInt(envValue, 10);
  if (Number.isNaN(parsed)) {
    return configMaxPages;
  }
  return Math.min(Math.max(parsed, 1), configMaxPages);
}
