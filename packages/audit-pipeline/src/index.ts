export const AUDIT_PIPELINE_VERSION = "0.0.0";

export {
  AUDIT_STATUSES,
  TERMINAL_STATUSES,
  canTransition,
  isTerminal,
} from "./workflow-states.js";
export type { AuditStatus, TerminalStatus } from "./workflow-states.js";

export {
  LOCALES,
  auditContextSchema,
  createAuditRequestSchema,
} from "./audit-context.js";
export type { AuditContext, CreateAuditRequest, Locale } from "./audit-context.js";

export {
  ELIGIBILITY_COOKIE_NAME,
  generateAuditSecret,
  hashAuditSecret,
  incrementEligibilityCookie,
  signEligibilityCookie,
  verifyEligibilityCookie,
} from "./secrets.js";
export type { EligibilityCounts } from "./secrets.js";

export { TIER_NAMES, TIER_SCOPES, decideTier, loadTierScopes } from "./eligibility.js";
export type { TierName, TierScope } from "./eligibility.js";
