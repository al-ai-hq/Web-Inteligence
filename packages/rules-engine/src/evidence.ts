export interface EvidenceBundle {
  methodology_version: string;
  tier: "rich" | "reduced" | "preview";
  locale: "en" | "ar";
  site: {
    root_url: string;
    homepage: PageEvidence | null;
    robots: RobotsEvidence;
    sitemap: SitemapEvidence;
    llms_txt: { present: boolean; references: string[] } | null;
    security: { https_valid: boolean; cert_error?: string; hsts: boolean };
  };
  pages: PageEvidence[];
  connectors: {
    psi?: PsiEvidence;
    crux?: CruxEvidence;
    gsc?: GscEvidence;
  };
  keyword_data?: never;
  business_profile?: {
    connector_id: string;
    data: { name?: string; phone?: string; address?: string };
  };
  fact_sheet?: { business_name?: string; phone?: string };
}

export interface PageEvidence {
  evidence_id: string;
  url: string;
  final_url: string;
  status_code: number;
  content_type: string;
  content_hash: string;
  fetched_at: string;
  render: { rendered: boolean; render_reason?: string };
  title: string | null;
  meta_description: string | null;
  canonical: string | null;
  lang: string | null;
  viewport_meta: string | null;
  headings: { level: number; text: string }[];
  word_count: number;
  main_content_bytes: number;
  structured_data: JsonLdBlock[];
  links: { href: string; rel?: string }[];
  robots_directive: "index" | "noindex" | "none";
}

export interface RobotsEvidence {
  fetched: boolean;
  content?: string;
  directives: Array<{ user_agent: string; allow: string[]; disallow: string[] }>;
}

export interface SitemapEvidence {
  present: boolean;
  url_count?: number;
}

export interface PsiEvidence {
  performance_score: number;
  lcp: number;
  fid: number;
  cls: number;
}

export interface CruxEvidence {
  lcp: number;
  inp: number;
  cls: number;
}

export interface GscEvidence {
  indexed_urls: number;
  valid_pages: number;
}

export interface JsonLdBlock {
  type: string;
  data: Record<string, unknown>;
}
