export interface RawEvidence {
  url: string;
  finalUrl: string;
  statusCode: number;
  contentHash: string;
  redirectChain: string[];
  contentType?: string;
  headings: Array<{ level: number; text: string }>;
  links: string[];
  language?: string;
  direction?: string;
  structuredData: unknown[];
  textByteLength: number;
  fetchedAt: string;
}

export interface EvidenceObject {
  audit_id: string;
  url: string;
  kind: "http_response" | "http_response_with_render";
  fetched_at: string;
  content_hash: string;
  content_type: string;
  status_code: number;
  headers: Record<string, string>;
  body: string;
  raw_expires_at: string;
  injection_suspected: boolean;
  immutable: true;
  final_url: string;
  redirect_chain: string[];
  headings: Array<{ level: number; text: string }>;
  links: string[];
  language?: string;
  direction?: string;
  structured_data: unknown[];
  text_byte_length: number;
}

export interface NormalizeOptions {
  auditId: string;
  injectionSuspected: boolean;
  rawExpiresAt?: string;
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function normalizeEvidence(raw: RawEvidence, options: NormalizeOptions): EvidenceObject {
  const contentHash = raw.contentHash.startsWith("sha256:")
    ? raw.contentHash
    : `sha256:${raw.contentHash}`;

  const rawExpiresAt =
    options.rawExpiresAt ??
    new Date(new Date(raw.fetchedAt).getTime() + TWENTY_FOUR_HOURS_MS).toISOString();

  const body = JSON.stringify({
    headings: raw.headings,
    links: raw.links,
    structuredData: raw.structuredData,
    textByteLength: raw.textByteLength,
  });

  return {
    audit_id: options.auditId,
    url: raw.url,
    kind: "http_response",
    fetched_at: raw.fetchedAt,
    content_hash: contentHash,
    content_type: raw.contentType ?? "text/html",
    status_code: raw.statusCode,
    headers: {},
    body,
    raw_expires_at: rawExpiresAt,
    injection_suspected: options.injectionSuspected,
    immutable: true,
    final_url: raw.finalUrl,
    redirect_chain: raw.redirectChain,
    headings: raw.headings,
    links: raw.links,
    language: raw.language,
    direction: raw.direction,
    structured_data: raw.structuredData,
    text_byte_length: raw.textByteLength,
  };
}
