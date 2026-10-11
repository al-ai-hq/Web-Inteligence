export interface ExtractedProfile {
  extracted_name: string | null;
  extracted_phone: string | null;
  extracted_email: string | null;
  extracted_address: Record<string, string | null> | null;
  extracted_hours: Record<string, string> | null;
  extracted_social: Record<string, string> | null;
  extraction_confidence: number;
}

export function extractProfileData(html: string, sourceUrl: string): ExtractedProfile {
  const result: ExtractedProfile = {
    extracted_name: null,
    extracted_phone: null,
    extracted_email: null,
    extracted_address: null,
    extracted_hours: null,
    extracted_social: null,
    extraction_confidence: 0,
  };

  let extractedFields = 0;

  const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  if (h1Match) {
    result.extracted_name = h1Match[1]!.replace(/<[^>]*>/g, "").trim();
    extractedFields++;
  }

  const telMatch = html.match(/href="tel:([^"]+)"/i);
  if (telMatch) {
    result.extracted_phone = telMatch[1]!;
    extractedFields++;
  }

  const mailtoMatch = html.match(/href="mailto:([^"]+)"/i);
  if (mailtoMatch) {
    result.extracted_email = mailtoMatch[1]!;
    extractedFields++;
  }

  const streetAddress = html.match(/itemprop="streetAddress"[^>]*>(.*?)</s);
  const addressLocality = html.match(/itemprop="addressLocality"[^>]*>(.*?)</s);
  const addressRegion = html.match(/itemprop="addressRegion"[^>]*>(.*?)</s);
  const postalCode = html.match(/itemprop="postalCode"[^>]*>(.*?)</s);
  const addressCountry = html.match(/itemprop="addressCountry"[^>]*>(.*?)</s);

  if (streetAddress || addressLocality) {
    result.extracted_address = {
      street: streetAddress ? stripTags(streetAddress[1]!) : null,
      city: addressLocality ? stripTags(addressLocality[1]!) : null,
      region: addressRegion ? stripTags(addressRegion[1]!) : null,
      postal_code: postalCode ? stripTags(postalCode[1]!) : null,
      country: addressCountry ? stripTags(addressCountry[1]!) : null,
    };
    extractedFields++;
  }

  const totalPossibleFields = 6;
  result.extraction_confidence = extractedFields / totalPossibleFields;

  return result;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, "").trim();
}
