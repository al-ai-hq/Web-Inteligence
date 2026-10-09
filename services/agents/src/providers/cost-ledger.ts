import type { CapCheckDecision } from "../visibility/types.js";

export interface CostLedgerConfig {
  monthlyHardCap: number;
  paidStopAt: number;
  perAuditSoftCap: number;
  perAuditHardCap: number;
}

export interface CapCheck {
  decision: CapCheckDecision;
  month_to_date: number;
  checked_at: Date;
}

export interface PostCallInput {
  audit_id: string;
  provider: string;
  model_id: string;
  tokens_in: number;
  tokens_out: number;
  amount: number;
  workflow:
    | "anonymous_audit"
    | "registered_audit"
    | "prompt_panel"
    | "keyword_sync"
    | "content"
    | "verification"
    | "report"
    | "other";
}

export interface CostLedgerEntry {
  entry_id: string;
  occurred_at: Date;
  line: "paid_call";
  entry_type: "actual";
  provider: string;
  model_id: string;
  audit_id: string;
  workflow: string;
  tokens: { input: number; output: number };
  amount: number;
  source: "post_call_actual";
  reconciled: boolean;
}

const DEFAULT_CONFIG: CostLedgerConfig = {
  monthlyHardCap: 150.0,
  paidStopAt: 140.0,
  perAuditSoftCap: 3.0,
  perAuditHardCap: 4.0,
};

let entryCounter = 0;

export class CostLedger {
  private entries: CostLedgerEntry[] = [];
  private config: CostLedgerConfig;

  constructor(config?: Partial<CostLedgerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  preCallCheck(auditId: string, _estimatedCost: number): CapCheck {
    const monthToDate = this.getMonthlyTotal();
    const auditCost = this.getAuditCost(auditId).total_usd;

    let decision: CapCheckDecision;
    if (monthToDate >= this.config.paidStopAt) {
      decision = "denied_monthly_cap";
    } else if (auditCost >= this.config.perAuditHardCap) {
      decision = "denied_audit_hard_cap";
    } else if (auditCost > this.config.perAuditSoftCap) {
      decision = "allowed_soft_cap_reached";
    } else {
      decision = "allowed";
    }

    return { decision, month_to_date: monthToDate, checked_at: new Date() };
  }

  postCallRecord(input: PostCallInput): void {
    entryCounter++;
    this.entries.push({
      entry_id: `cle-${entryCounter}`,
      occurred_at: new Date(),
      line: "paid_call",
      entry_type: "actual",
      provider: input.provider,
      model_id: input.model_id,
      audit_id: input.audit_id,
      workflow: input.workflow,
      tokens: { input: input.tokens_in, output: input.tokens_out },
      amount: input.amount,
      source: "post_call_actual",
      reconciled: false,
    });
  }

  getAuditCost(auditId: string): { total_usd: number; call_count: number } {
    const auditEntries = this.entries.filter((e) => e.audit_id === auditId);
    return {
      total_usd: auditEntries.reduce((sum, e) => sum + e.amount, 0),
      call_count: auditEntries.length,
    };
  }

  getMonthlyTotal(): number {
    return this.entries.reduce((sum, e) => sum + e.amount, 0);
  }
}
