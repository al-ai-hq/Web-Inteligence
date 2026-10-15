export type AuditView =
  { kind: "running" } | { kind: "ready" } | { kind: "failed"; reasonKey: string };

export function describeAuditView(status: string, failureReason: string | null): AuditView {
  if (status === "READY_COMPLETE" || status === "READY_PARTIAL") {
    return { kind: "ready" };
  }
  if (status === "FAILED") {
    return { kind: "failed", reasonKey: failureReason ?? "failure.pipeline_error" };
  }
  return { kind: "running" };
}
