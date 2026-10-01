interface CostEntry {
  audit_id: string;
  agent_name: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  usd: number;
  timestamp?: Date;
}

interface CostSummary {
  audit_id: string;
  total_usd: number;
  call_count: number;
  soft_cap_reached: boolean;
}

interface CostTrackerConfig {
  monthlyHardCap: number;
  paidStopAt: number;
  perAuditSoftCap: number;
  perAuditHardCap: number;
}

const DEFAULT_CONFIG: CostTrackerConfig = {
  monthlyHardCap: 150.0,
  paidStopAt: 140.0,
  perAuditSoftCap: 3.0,
  perAuditHardCap: 4.0,
};

export class CostTracker {
  private entries: CostEntry[] = [];
  private config: CostTrackerConfig;

  constructor(config?: Partial<CostTrackerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  record(entry: CostEntry): void {
    this.entries.push({
      ...entry,
      timestamp: entry.timestamp ?? new Date(),
    });
  }

  getAuditCost(auditId: string): CostSummary {
    const auditEntries = this.entries.filter((e) => e.audit_id === auditId);
    const total = auditEntries.reduce((sum, e) => sum + e.usd, 0);
    return {
      audit_id: auditId,
      total_usd: total,
      call_count: auditEntries.length,
      soft_cap_reached: total > this.config.perAuditSoftCap,
    };
  }

  getMonthlyTotal(): number {
    return this.entries.reduce((sum, e) => sum + e.usd, 0);
  }

  canProceed(auditId: string): boolean {
    const monthlyTotal = this.getMonthlyTotal();
    if (monthlyTotal >= this.config.paidStopAt) return false;

    const auditCost = this.getAuditCost(auditId).total_usd;
    if (auditCost >= this.config.perAuditHardCap) return false;

    return true;
  }
}
