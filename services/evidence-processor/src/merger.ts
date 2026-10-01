import type { EvidenceObject } from "./normalizer.js";

export interface RenderedEvidence {
  url: string;
  renderedAt: string;
  domSnapshot: string;
  contentHash: string;
  renderDurationMs: number;
}

export interface MergedEvidenceObject extends EvidenceObject {
  rendered_dom?: string;
  rendered_at?: string;
  render_content_hash?: string;
  render_duration_ms?: number;
}

export function mergeEvidence(
  normalized: EvidenceObject,
  rendered?: RenderedEvidence,
): MergedEvidenceObject {
  if (rendered === undefined) {
    return normalized;
  }

  const contentHash = rendered.contentHash.startsWith("sha256:")
    ? rendered.contentHash
    : `sha256:${rendered.contentHash}`;

  return {
    ...normalized,
    kind: "http_response_with_render",
    rendered_dom: rendered.domSnapshot,
    rendered_at: rendered.renderedAt,
    render_content_hash: contentHash,
    render_duration_ms: rendered.renderDurationMs,
  };
}
