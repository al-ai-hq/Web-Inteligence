export type ApprovalState = 'draft' | 'validated' | 'previewed' | 'approved' | 'rejected';

export interface TransitionContext {
  checksPassed?: boolean;
}

export function transitionState(
  current: ApprovalState,
  target: ApprovalState,
  context: TransitionContext
): { ok: boolean; newState?: ApprovalState; error?: string } {
  const validTransitions: Record<ApprovalState, ApprovalState[]> = {
    draft: ['validated', 'rejected'],
    validated: ['previewed', 'rejected'],
    previewed: ['approved', 'rejected'],
    approved: [],
    rejected: [],
  };

  if (!validTransitions[current]?.includes(target)) {
    return { ok: false, error: `Invalid transition from ${current} to ${target}` };
  }

  if (target === 'validated' && !context.checksPassed) {
    return { ok: false, error: 'Cannot validate: deterministic checks failed' };
  }

  return { ok: true, newState: target };
}
