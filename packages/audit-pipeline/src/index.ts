export const AUDIT_PIPELINE_VERSION = "0.0.0";

export {
  AUDIT_STATUSES,
  TERMINAL_STATUSES,
  canTransition,
  isTerminal,
} from "./workflow-states.js";
export type { AuditStatus, TerminalStatus } from "./workflow-states.js";
