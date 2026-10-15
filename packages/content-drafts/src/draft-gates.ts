export interface DraftGateInput {
  briefStatus: string;
  author: string;
  clientInputReceived: boolean;
  clusterMapped: boolean;
  monthlyDraftCount: number;
}

export function checkDraftGates(input: DraftGateInput): { ok: boolean; error?: string } {
  if (input.briefStatus !== "approved") {
    return { ok: false, error: "brief must be approved before creating a draft" };
  }
  if (!input.author || input.author.trim() === "") {
    return { ok: false, error: "draft must have a named human author" };
  }
  if (!input.clientInputReceived) {
    return { ok: false, error: "client input is required before starting a draft" };
  }
  if (input.clusterMapped) {
    return { ok: false, error: "cluster is already mapped to an existing page" };
  }
  if (input.monthlyDraftCount >= 8) {
    return { ok: false, error: "monthly draft limit of 8 has been reached" };
  }
  return { ok: true };
}
