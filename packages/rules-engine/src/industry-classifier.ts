/**
 * Industry classification (M10 spec §industry playbooks).
 *
 * `business_type` is free-text user input from the audit form, so it is compacted
 * (non-alphanumerics dropped, lowercased) before lookup — "e-commerce", "E-Commerce"
 * and "ecommerce" all resolve to the same industry. Signals are tried in precedence
 * order and the winning signal is reported as the basis so the UI can show provenance.
 */

export type Industry =
  | "saas"
  | "ecommerce"
  | "local"
  | "publisher"
  | "professional_services"
  | "generic";

export interface IndustrySignals {
  business_type?: string;
  schema_types?: string[];
  url_paths?: string[];
}

export interface IndustryClassification {
  industry: Industry;
  basis: string;
}

const BUSINESS_TYPE_MAP: Record<string, Industry> = {
  saas: "saas",
  software: "saas",
  technology: "saas",
  b2b: "saas",
  ecommerce: "ecommerce",
  retail: "ecommerce",
  shop: "ecommerce",
  store: "ecommerce",
  local: "local",
  restaurant: "local",
  clinic: "local",
  servicearea: "local",
  publisher: "publisher",
  blog: "publisher",
  news: "publisher",
  media: "publisher",
  professionalservices: "professional_services",
  agency: "professional_services",
  consulting: "professional_services",
  law: "professional_services",
  accounting: "professional_services",
};

function compact(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function fromBusinessType(value?: string): IndustryClassification | null {
  if (!value) return null;
  const mapped = BUSINESS_TYPE_MAP[compact(value)];
  if (!mapped) return null;
  return { industry: mapped, basis: `business_type:${value.trim()}` };
}

function fromSchemaTypes(types?: string[]): IndustryClassification | null {
  if (!types || types.length === 0) return null;
  const set = new Set(types.map((type) => type.toLowerCase()));
  if (set.has("product") || set.has("offer")) {
    return { industry: "ecommerce", basis: "schema_types:Product" };
  }
  if (set.has("localbusiness")) {
    return { industry: "local", basis: "schema_types:LocalBusiness" };
  }
  if (set.has("newsarticle") || set.has("blogposting") || set.has("article")) {
    return { industry: "publisher", basis: "schema_types:NewsArticle" };
  }
  if (set.has("professionalservice") || set.has("legalservice") || set.has("accountingservice")) {
    return { industry: "professional_services", basis: "schema_types:ProfessionalService" };
  }
  if (set.has("softwareapplication")) {
    return { industry: "saas", basis: "schema_types:SoftwareApplication" };
  }
  return null;
}

function fromUrlPaths(paths?: string[]): IndustryClassification | null {
  if (!paths || paths.length === 0) return null;
  const joined = paths.join(" ").toLowerCase();
  if (joined.includes("/shop/") || joined.includes("/product") || joined.includes("/cart/")) {
    return { industry: "ecommerce", basis: "url_paths" };
  }
  if (joined.includes("/blog/") || joined.includes("/news/") || joined.includes("/article")) {
    return { industry: "publisher", basis: "url_paths" };
  }
  if (joined.includes("/services/") || joined.includes("/consulting/")) {
    return { industry: "professional_services", basis: "url_paths" };
  }
  return null;
}

export function classifyIndustry(signals: IndustrySignals): IndustryClassification {
  return (
    fromBusinessType(signals.business_type) ??
    fromSchemaTypes(signals.schema_types) ??
    fromUrlPaths(signals.url_paths) ?? { industry: "generic", basis: "default" }
  );
}
