export { AUDIT_STATUSES, TERMINAL_STATUSES, canTransition, isTerminal } from "./workflow-states.js";
export type { AuditStatus, TerminalStatus } from "./workflow-states.js";
export { LOCALES, auditContextSchema, createAuditRequestSchema } from "./audit-context.js";
export type { AuditContext, CreateAuditRequest } from "./audit-context.js";
export {
  ELIGIBILITY_COOKIE_NAME,
  generateAuditSecret,
  hashAuditSecret,
  incrementEligibilityCookie,
  signEligibilityCookie,
  verifyEligibilityCookie,
} from "./secrets.js";
export { TIER_NAMES, TIER_SCOPES, decideTier, loadTierScopes } from "./eligibility.js";
export type { TierName, TierScope } from "./eligibility.js";
export { REPO_ROOT } from "./paths.js";
export { InMemoryAuditStore } from "./audit-store.js";
export type {
  AuditRecord,
  AuditStore,
  CreateAuditInput,
  GetActiveResult,
  TransitionResult,
} from "./audit-store.js";
export { SECTION_BY_AGENT } from "./report-envelope.js";
export type {
  ComposerAgentOutcome,
  ComposerFinding,
  FindingSection,
  FindingSeverity,
  FindingState,
  ReportModel,
  ReportSampleDisclosure,
  StoredActionItem,
  StoredCostLine,
  StoredCosts,
  StoredFinding,
  StoredReportEnvelope,
  UnavailableBlock,
} from "./report-envelope.js";
export { MIGRATIONS_DIR, applyMigrations } from "./migrations/migrate.js";
export { PostgresAuditStore } from "./postgres-audit-store.js";
export type { MigrationResult } from "./migrations/migrate.js";
export {
  composeSections,
  deriveActionItems,
  mapPriorityItem,
  deriveSeverity,
  deriveUnavailable,
} from "./composer.js";
export type { ComposeResult, RulesEngineOutput } from "./composer.js";
export { deriveSiteStage, normalizeDomain } from "./site-identity.js";
export type { SiteStage } from "./site-identity.js";
export { OUTCOME_METRICS } from "./outcome-store.js";
export type {
  MarkAppliedInput,
  OutcomeDelta,
  OutcomeMetric,
  OutcomeStore,
  RecordDeltasInput,
  RecommendationOutcome,
} from "./outcome-store.js";
export { InMemoryOutcomeStore } from "./in-memory-outcome-store.js";
export { PostgresOutcomeStore } from "./postgres-outcome-store.js";
export { recordOutcomeDeltas } from "./outcome-service.js";
export { buildReportModel, validateReportModel } from "./report-model.js";
export type { BuildReportModelParams } from "./report-model.js";
export { M4_AGENT_NAMES, runAgentStage } from "./agent-stage.js";
export type { AgentStageDeps, M4AgentName } from "./agent-stage.js";
export { FsEvidenceStorage } from "./evidence-storage.js";
export { agentConfigSchema, loadAgentConfig } from "./agent-config.js";
export type { AgentYamlConfig } from "./agent-config.js";
export { BASE_LIMITATION_KEYS, PipelineStoppedError, runAuditPipeline } from "./pipeline.js";
export type { PipelineDeps, PipelineOutcome } from "./pipeline.js";
export { InProcessDispatcher, scopedEnv, sleep, StubDispatcher } from "./dispatcher.js";
export type { JobDispatcher } from "./dispatcher.js";
