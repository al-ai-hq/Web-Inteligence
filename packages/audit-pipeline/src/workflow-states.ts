export const AUDIT_STATUSES = [
  "QUEUED",
  "VALIDATING",
  "CRAWLING",
  "EXTRACTING",
  "AUDITING",
  "ENRICHING_OPTIONAL",
  "COMPOSING",
  "READY_PARTIAL",
  "READY_COMPLETE",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
] as const;

export type AuditStatus = (typeof AUDIT_STATUSES)[number];

export const TERMINAL_STATUSES = [
  "READY_PARTIAL",
  "READY_COMPLETE",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
] as const;

export type TerminalStatus = (typeof TERMINAL_STATUSES)[number];

export function isTerminal(status: AuditStatus): status is TerminalStatus {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

const TRANSITIONS: Record<AuditStatus, readonly AuditStatus[]> = {
  QUEUED: ["VALIDATING"],
  VALIDATING: ["CRAWLING", "FAILED"],
  CRAWLING: ["EXTRACTING", "FAILED"],
  EXTRACTING: ["ENRICHING_OPTIONAL", "AUDITING", "FAILED"],
  ENRICHING_OPTIONAL: ["AUDITING", "FAILED"],
  AUDITING: ["COMPOSING", "FAILED"],
  COMPOSING: ["READY_PARTIAL", "READY_COMPLETE", "FAILED"],
  READY_PARTIAL: ["EXPIRED"],
  READY_COMPLETE: ["EXPIRED"],
  FAILED: ["EXPIRED"],
  CANCELLED: ["EXPIRED"],
  EXPIRED: [],
};

export function canTransition(from: AuditStatus, to: AuditStatus): boolean {
  return TRANSITIONS[from].includes(to);
}
