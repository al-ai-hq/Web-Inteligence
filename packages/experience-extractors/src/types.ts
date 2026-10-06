export interface HeadingInfo {
  level: number;
  text: string;
  id?: string;
}

export interface HeadingStructure {
  headings: HeadingInfo[];
  h1Count: number;
  hasLogicalOrder: boolean;
  primaryHeading?: string;
}

export interface FormField {
  name: string;
  type: string;
  label?: string;
  required: boolean;
  hasLabel: boolean;
}

export interface FormInfo {
  id?: string;
  action?: string;
  method?: string;
  fields: FormField[];
  fieldCount: number;
  hasPrivacyTextNearby: boolean;
}

export interface FormAnalysis {
  forms: FormInfo[];
  totalForms: number;
  totalFields: number;
  fieldsWithLabels: number;
  fieldsRequired: number;
  formsWithPrivacyText: number;
}

export interface ContactLink {
  type: "phone" | "email" | "whatsapp" | "telegram" | "messenger" | "other";
  href: string;
  text?: string;
}

export interface ContactLinks {
  links: ContactLink[];
  hasPhone: boolean;
  hasEmail: boolean;
  hasMessaging: boolean;
  totalLinks: number;
}

export interface PolicyLink {
  type: "privacy" | "terms" | "pricing" | "delivery" | "returns" | "cookies";
  href: string;
  text?: string;
}

export interface PolicyLinks {
  links: PolicyLink[];
  hasPrivacy: boolean;
  hasTerms: boolean;
  hasPricing: boolean;
  hasDelivery: boolean;
  hasReturns: boolean;
  totalLinks: number;
}

export interface LanguageAlternate {
  hreflang: string;
  href: string;
}

export interface LanguageSwitch {
  alternates: LanguageAlternate[];
  hasVisibleSwitcher: boolean;
  supportedLanguages: string[];
}

export interface AnalyticsTag {
  type: "ga4" | "ua" | "gtag" | "analytics.js" | "other";
  id?: string;
  detected: boolean;
}

export interface AnalyticsDetection {
  tags: AnalyticsTag[];
  hasAnalytics: boolean;
  hasGA4: boolean;
  tagCount: number;
}

export interface ViewportMetrics {
  viewportWidth: number;
  contentWidth: number;
  hasHorizontalScroll: boolean;
  overflowElements: string[];
}

export interface WayfindingCues {
  hasBreadcrumbs: boolean;
  breadcrumbElements: string[];
  hasActiveState: boolean;
  pageTitle?: string;
  hasClearHierarchy: boolean;
}

export interface ExtractionResult {
  headingStructure?: HeadingStructure;
  formAnalysis?: FormAnalysis;
  contactLinks?: ContactLinks;
  policyLinks?: PolicyLinks;
  languageSwitch?: LanguageSwitch;
  analyticsDetection?: AnalyticsDetection;
  viewportMetrics?: ViewportMetrics;
  wayfindingCues?: WayfindingCues;
}

export interface EvidencePackage {
  html: string;
  url: string;
  language: string;
  direction: "ltr" | "rtl";
  viewportWidth: number;
  screenshots?: {
    mobile?: string;
    desktop?: string;
  };
}

export interface Extractor {
  name: string;
  extract(evidence: EvidencePackage): Promise<unknown>;
}
