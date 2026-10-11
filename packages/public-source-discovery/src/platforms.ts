export interface DiscoveredProfile {
  platform: string;
  url: string;
}

export function generateProfileUrls(
  businessName: string,
  siteUrl: string,
  location?: { locality?: string; region?: string },
): DiscoveredProfile[] {
  if (!businessName.trim()) return [];

  const encodedName = encodeURIComponent(businessName);
  const profiles: DiscoveredProfile[] = [];

  const googleQuery = location
    ? `${encodedName}+${encodeURIComponent(location.locality ?? "")}+${encodeURIComponent(location.region ?? "")}`
    : encodedName;
  profiles.push({
    platform: "google",
    url: `https://www.google.com/maps/search/${googleQuery}`,
  });

  const yelpQuery = location
    ? `${encodedName}+${encodeURIComponent(location.locality ?? "")}+${encodeURIComponent(location.region ?? "")}`
    : encodedName;
  profiles.push({
    platform: "yelp",
    url: `https://www.yelp.com/search?find_desc=${yelpQuery}`,
  });

  profiles.push({
    platform: "facebook",
    url: `https://www.facebook.com/search/pages/?q=${encodedName}`,
  });

  profiles.push({
    platform: "linkedin",
    url: `https://www.linkedin.com/search/results/companies/?keywords=${encodedName}`,
  });

  profiles.push({
    platform: "twitter",
    url: `https://twitter.com/search?q=${encodedName}&src=typed_query&f=user`,
  });

  return profiles;
}
