import { randomUUID } from "node:crypto";
import type { ConnectorResult } from "@wpi/connectors";
import type { TierScope } from "./eligibility.js";
import type {
  ComposerAgentOutcome,
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

export interface ComposeResult {
  findings: StoredFinding[];
  unavailable: UnavailableBlock[];
  action_board: StoredActionItem[];
  summary_bullets: string[];
  costs: StoredCosts;
}

export function composeSections(
  outcomes: ComposerAgentOutcome[],
  connectorResults: ConnectorResult[],
  scope: TierScope,
): ComposeResult {
  const findings: StoredFinding[] = [];
  const unavailable: UnavailableBlock[] = [];
  const costLines: StoredCostLine[] = [];
  const availableSections = new Set<string>();

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

  return {
    findings,
    unavailable,
    action_board: deriveActionItems(findings, scope.actionBoardCap),
    summary_bullets: SECTION_ORDER.filter((section) => availableSections.has(section)).map(
      (section) => `report.summary.${section}`,
    ),
    costs: {
      currency: "USD",
      agents: costLines,
      total_usd: costLines.reduce((sum, line) => sum + line.usd, 0),
    },
  };
}
