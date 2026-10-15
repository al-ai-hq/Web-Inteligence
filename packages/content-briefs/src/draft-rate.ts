const MAX_DRAFTS_PER_MONTH = 8;

export function checkDraftRate(
  projectId: string,
  monthStart: Date,
  currentCount: number,
): { ok: boolean; error?: string } {
  if (currentCount >= MAX_DRAFTS_PER_MONTH) {
    return {
      ok: false,
      error: `Project ${projectId} has reached the monthly limit of ${MAX_DRAFTS_PER_MONTH} drafts. Wait until next month or request an exception.`,
    };
  }
  return { ok: true };
}
