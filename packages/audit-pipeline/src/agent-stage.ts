import { join } from "node:path";
import {
  buildSystemPrompt,
  buildUserPrompt,
  createCheckCannibalizationTool,
  createClusterKeywordsTool,
  createDraftArticleTool,
  createFindOpportunitiesTool,
  createGetEvidenceTool,
  createImportKeywordsTool,
  createMapKeywordsTool,
  createValidateSchemaTool,
  createWriteBriefTool,
  executeAgent,
  GeminiAdapter,
  Orchestrator,
  resolveModel,
  ToolRegistry,
  type AgentResult,
  type CostTracker,
  type ExecuteAgentParams,
} from "@wpi/agents";
import { loadAgentConfig } from "./agent-config.js";
import type { AuditContext } from "./audit-context.js";
import { FsEvidenceStorage } from "./evidence-storage.js";
import { REPO_ROOT } from "./paths.js";
import type { ComposerAgentOutcome } from "./report-envelope.js";

export const M4_AGENT_NAMES = ["auditor", "keyword-analyst", "content-strategist"] as const;

export type M4AgentName = (typeof M4_AGENT_NAMES)[number];

export interface AgentStageDeps {
  auditId: string;
  projectId: string;
  targetUrl: string;
  context: AuditContext;
  evidenceIds: string[];
  outputDir: string;
  geminiApiKey: string;
  costTracker?: CostTracker;
  runner?: (params: ExecuteAgentParams) => Promise<AgentResult>;
}

export async function runAgentStage(deps: AgentStageDeps): Promise<ComposerAgentOutcome[]> {
  if (deps.costTracker !== undefined && !deps.costTracker.canProceed(deps.auditId)) {
    return M4_AGENT_NAMES.map((agentName) => ({
      agent_name: agentName,
      ok: false,
      findings: [],
      limitations: [],
      unavailable_reason_key: "unavailable.budget_cap",
    }));
  }

  const registry = new ToolRegistry();
  registry.register(createGetEvidenceTool(new FsEvidenceStorage(deps.outputDir)));
  registry.register(createImportKeywordsTool());
  registry.register(createClusterKeywordsTool());
  registry.register(createMapKeywordsTool());
  registry.register(createCheckCannibalizationTool());
  registry.register(createFindOpportunitiesTool());
  registry.register(createWriteBriefTool());
  registry.register(createDraftArticleTool());
  registry.register(createValidateSchemaTool());

  const provider = new GeminiAdapter(deps.geminiApiKey);
  const orchestrator = new Orchestrator();
  const runner = deps.runner ?? executeAgent;

  const outcomes: ComposerAgentOutcome[] = [];
  for (const agentName of M4_AGENT_NAMES) {
    const config = loadAgentConfig(join(REPO_ROOT, "config", "agents", `${agentName}.yaml`));
    const allowedNames = config.tools.filter((toolName) => registry.get(toolName) !== undefined);
    const tools = registry.resolveAll(allowedNames);
    const jobs = orchestrator.createJobs(
      {
        audit_id: deps.auditId,
        project_id: deps.projectId,
        input_evidence_ids: deps.evidenceIds,
        context: {
          site: deps.targetUrl,
          market: deps.context.market,
          language: deps.context.customer_language,
          business_goal: deps.context.offering,
        },
        capture_time: new Date().toISOString(),
      },
      [config.name],
    );
    const job = jobs[0];
    if (job === undefined) {
      throw new Error(`Orchestrator returned no job for agent ${config.name}`);
    }
    const result = await runner({
      agentName: config.name,
      allowedTools: allowedNames,
      job,
      provider,
      tools,
      systemPrompt: buildSystemPrompt({
        agentName: config.name,
        modelTier: config.model_tier,
        readsUntrustedContent: config.reads_untrusted_content,
      }),
      userPrompt: buildUserPrompt({
        job,
        evidenceContext:
          deps.evidenceIds.length > 0
            ? `Evidence files available via get_evidence for ids: ${deps.evidenceIds.join(", ")}`
            : "No evidence files available.",
      }),
      toolContext: {
        audit_id: deps.auditId,
        project_id: deps.projectId,
        evidence_bucket: deps.outputDir,
      },
      model: resolveModel(config.model_tier),
    });
    const ok = result.result_state !== "unavailable";
    deps.costTracker?.record({
      audit_id: deps.auditId,
      agent_name: config.name,
      model: result.cost.engine,
      tokens_in: result.cost.tokens_in,
      tokens_out: result.cost.tokens_out,
      usd: result.cost.usd,
    });
    outcomes.push({
      agent_name: config.name,
      ok,
      findings: result.findings.map((finding) => ({
        finding_id: finding.finding_id,
        result_state: finding.result_state,
        confidence: finding.confidence,
        evidence_ids: [...finding.evidence_ids],
        data: { ...finding.data },
        limitations: [...finding.limitations],
      })),
      limitations: [...result.limitations],
      cost: {
        engine: result.cost.engine,
        tokens_in: result.cost.tokens_in,
        tokens_out: result.cost.tokens_out,
        usd: result.cost.usd,
      },
      unavailable_reason_key: ok ? undefined : `unavailable.agent.${config.name}`,
    });
  }
  return outcomes;
}
