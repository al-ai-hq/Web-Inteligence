export function checkCannibalization(
  clusterId: string,
  targetUrl: string | null,
  existingMappings: Map<string, string>
): { ok: boolean; error?: string } {
  if (targetUrl !== null) {
    return { ok: true };
  }

  const existingUrl = existingMappings.get(clusterId);
  if (existingUrl) {
    return {
      ok: false,
      error: `Cluster ${clusterId} is already mapped to ${existingUrl}. Improve that page instead of creating a new one.`,
    };
  }
  return { ok: true };
}
