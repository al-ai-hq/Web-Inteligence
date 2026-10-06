import { randomUUID } from "node:crypto";
import type { ConnectorResult } from "@wpi/connectors";
import type { Finding, PriorityItem, RuleCategory, ScoreResult } from "@wpi/rules-engine";
import type { TierScope } from "./eligibility.js";
import type {
  ComposerAgentOutcome,
  FindingSection,
  FindingSeverity,
  StoredActionItem,
  StoredCostLine,
  StoredCosts,
  StoredFinding,
  UnavailableBlock,
} from "./report-envelope.js";
import { SECTION_BY_AGENT } from "./report-envelope.js";

const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};

const CONFIDENCE_ORDER: Record<"high" | "medium" | "low", number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const SECTION_ORDER = ["technical", "keywords", "content", "performance"] as const;

const CONNECTOR_SECTION: Record<string, "keywords" | "performance"> = {
  psi: "performance",
  crux: "performance",
  gsc: "keywords",
  ga4: "performance",
};

// ─── Rules engine category → report section mapping ─────────────────────────

const CATEGORY_TO_SECTION: Record<RuleCategory, FindingSection> = {
  crawlability: "technical",
  on_page: "technical",
  structured_data: "technical",
  aeo: "content",
  geo: "content",
  i18n_accessibility: "content",
  performance_security: "performance",
};

// ─── Rules engine output (processed by pipeline, consumed by composer) ───────

export interface RulesEngineOutput {
  findings: Finding[];
  priority_items: PriorityItem[];
  score: ScoreResult | null;
  unavailable_categories: RuleCategory[];
}

// ─── Mapping helpers ────────────────────────────────────────────────────────

function mapEvidenceState(
  state: Finding["evidence_state"],
): "verified" | "inferred" | "not_verified" {
  switch (state) {
    case "verified":
      return "verified";
    case "inferred":
      return "inferred";
    case "client_stated":
      return "not_verified";
  }
}

function mapEvidenceConfidence(
  state: Finding["evidence_state"],
): "high" | "medium" | "low" {
  switch (state) {
    case "verified":
      return "high";
    case "inferred":
      return "medium";
    case "client_stated":
      return "low";
  }
}

function mapRulesFinding(f: Finding): StoredFinding {
  return {
    id: randomUUID(),
    agent: "rules-engine",
    section: CATEGORY_TO_SECTION[f.category],
    severity: f.severity as FindingSeverity,
    state: mapEvidenceState(f.evidence_state),
    confidence: mapEvidenceConfidence(f.evidence_state),
    evidence_ids: [...f.evidence_ids],
    data: {
      rule_id: f.rule_id,
      rationale: f.rationale,
      category: f.category,
      evidence_state: f.evidence_state,
      affected_scope: f.affected_scope,
    },
  };
}

function mapPriorityItem(
  item: PriorityItem,
  findingIdMap: Map<string, string>,
): StoredActionItem {
  return {
    title: item.rule_id,
    detail: item.rationale ?? item.rule_id,
    severity: item.severity as FindingSeverity,
    confidence: "high", // deterministic rules → high confidence
    source_finding_id: findingIdMap.get(item.rule_id) ?? "",
  };
}

// ─── Existing functions (unchanged) ─────────────────────────────────────────

export function deriveSeverity(data: Record<string, unknown>): FindingSeverity {
  const value = data["severity"];
  if (
    value === "critical" ||
    value === "high" ||
    value === "medium" ||
    value === "low"
  ) {
    return value;
  }
  return "info";
}

export function deriveUnavailable(scope: TierScope): UnavailableBlock[] {
  const blocks: UnavailableBlock[] = [
    { section: "technical", reason_key: "unavailable.score" },
    { section: "technical", reason_key: "unavailable.experience_effectiveness" },
  ];
  if (scope.comparisons > 0) {
    blocks.push({ section: "comparison", reason_key: "unavailable.comparison" });
  }
  if (scope.aiVisibilityPanel) {
    blocks.push({ section: "ai_visibility_panel", reason_key: "unavailable.ai_visibility_panel" });
  }
  return blocks;
}

export function deriveActionItems(
  findings: StoredFinding[],
  cap: number,
): StoredActionItem[] {
  const items: StoredActionItem[] = [];
  for (const finding of findings) {
    const recommendation = finding.data["recommendation"];
    if (typeof recommendation !== "string" || recommendation.length === 0) {
      continue;
    }
    const titleValue = finding.data["title"];
    const title =
      typeof titleValue === "string" && titleValue.length > 0
        ? titleValue
        : recommendation.slice(0, 60);
    items.push({
      title,
      detail: recommendation,
      severity: finding.severity,
      confidence: finding.confidence,
      source_finding_id: finding.id,
    });
  }
  items.sort((a, b) => {
    const byConfidence = CONFIDENCE_ORDER[b.confidence] - CONFIDENCE_ORDER[a.confidence];
    if (byConfidence !== 0) {
      return byConfidence;
    }
    return SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
  });
  return items.slice(0, cap);
}

// ─── ComposeResult ──────────────────────────────────────────────────────────

export interface ComposeResult {
  findings: StoredFinding[];
  unavailable: UnavailableBlock[];
  action_board: StoredActionItem[];
  summary_bullets: string[];
  costs: StoredCosts;
  score: ScoreResult | null;
}

// ─── composeSections ────────────────────────────────────────────────────────

export function composeSections(
  outcomes: ComposerAgentOutcome[],
  connectorResults: ConnectorResult[],
  scope: TierScope,
  rulesOutput?: RulesEngineOutput,
): ComposeResult {
  const findings: StoredFinding[] = [];
  const unavailable: UnavailableBlock[] = [];
  const costLines: StoredCostLine[] = [];
  const availableSections = new Set<string>();

  // If rules engine produced a score, use its unavailable categories instead
  // of the hardcoded "score deferred" placeholders.
  if (rulesOutput?.score) {
    for (const cat of rulesOutput.unavailable_categories) {
      const section = CATEGORY_TO_SECTION[cat];
      unavailable.push({
        section,
        reason_key: `unavailable.category.${cat}`,
      });
    }
  } else {
    // No score yet — fall back to the M1 hardcoded unavailable blocks.
    unavailable.push(
      { section: "technical", reason_key: "unavailable.score" },
      { section: "technical", reason_key: "unavailable.experience_effectiveness" },
    );
  }

  // Track rules engine findings by rule_id for priority item source lookup
  const findingIdByRuleId = new Map<string, string>();

  // Process rules engine findings first (deterministic-first ordering)
  if (rulesOutput) {
    for (const f of rulesOutput.findings) {
      const stored = mapRulesFinding(f);
      findingIdByRuleId.set(f.rule_id, stored.id);
      findings.push(stored);
      availableSections.add(stored.section);
    }
  }

  for (const outcome of outcomes) {
    const section = SECTION_BY_AGENT[outcome.agent_name] ?? "technical";
    if (!outcome.ok) {
      unavailable.push({
        section,
        reason_key: outcome.unavailable_reason_key ?? `unavailable.agent.${outcome.agent_name}`,
      });
      continue;
    }
    availableSections.add(section);
    for (const finding of outcome.findings) {
      if (finding.result_state === "unavailable") {
        continue;
      }
      findings.push({
        id: randomUUID(),
        agent: outcome.agent_name,
        section,
        severity: deriveSeverity(finding.data),
        state: finding.result_state,
        confidence: finding.confidence,
        evidence_ids: [...finding.evidence_ids],
        data: { ...finding.data },
      });
    }
    if (outcome.cost) {
      costLines.push({
        agent: outcome.agent_name,
        engine: outcome.cost.engine,
        tokens_in: outcome.cost.tokens_in,
        tokens_out: outcome.cost.tokens_out,
        usd: outcome.cost.usd,
      });
    }
  }

  for (const result of connectorResults) {
    const section = CONNECTOR_SECTION[result.connector] ?? "performance";
    if (!result.ok) {
      unavailable.push({
        section,
        reason_key: result.unavailable_reason_key,
      });
      continue;
    }
    availableSections.add(section);
  }

  // Build action board: start with agent-derived items, then add rules engine priority items
  const actionBoard = deriveActionItems(findings, scope.actionBoardCap);

  if (rulesOutput?.priority_items) {
    for (const pi of rulesOutput.priority_items) {
      actionBoard.push(mapPriorityItem(pi, findingIdByRuleId));
    }
  }

  return {
    findings,
    unavailable,
    action_board: actionBoard,
    summary_bullets: SECTION_ORDER.filter((section) => availableSections.has(section)).map(
      (section) => `report.summary.${section}`,
    ),
    costs: {
      currency: "USD",
      agents: costLines,
      total_usd: costLines.reduce((sum, line) => sum + line.usd, 0),
    },
    score: rulesOutput?.score ?? null,
  };
}
