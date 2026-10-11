export interface Approver {
  user_id: string;
  is_requester: boolean;
}

export function checkApprovalRequirements(
  riskTier: 1 | 2 | 3,
  approvers: Approver[]
): { ok: boolean; error?: string } {
  if (riskTier === 1 || riskTier === 2) {
    if (approvers.length < 1) {
      return { ok: false, error: 'Requires at least one approver' };
    }
    return { ok: true };
  }

  if (riskTier === 3) {
    if (approvers.length < 2) {
      return { ok: false, error: 'Tier 3 requires two approvers' };
    }
    if (approvers.some(a => a.is_requester)) {
      return { ok: false, error: 'Tier 3: requester cannot be an approver' };
    }
    return { ok: true };
  }

  return { ok: false, error: 'Invalid risk tier' };
}
