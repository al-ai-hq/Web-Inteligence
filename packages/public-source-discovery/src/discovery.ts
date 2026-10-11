import { generateProfileUrls, type DiscoveredProfile } from "./platforms.js";

export interface DiscoveryInput {
  businessName: string;
  siteUrl: string;
  location?: { locality?: string; region?: string };
}

export async function discoverPublicSources(input: DiscoveryInput): Promise<DiscoveredProfile[]> {
  return generateProfileUrls(input.businessName, input.siteUrl, input.location);
}
