import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
// ajv and ajv-formats ship CommonJS: under NodeNext the default import of
// "ajv/dist/2020.js" binds to the module namespace, not the class, so the
// named export is used (it exists in the compiled module). ajv-formats has
// no named export, so the default import is normalized to the callable
// plugin at runtime (module.exports is the plugin itself; bundlers expose
// exports.default).
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormatsDefault from "ajv-formats";
import type { FormatsPlugin } from "ajv-formats";
import type { ReportModel, StoredFinding } from "./report-envelope.js";

const addFormatsModule = addFormatsDefault as
  | FormatsPlugin
  | {
      default: FormatsPlugin;
    };
const addFormats: FormatsPlugin =
  typeof addFormatsModule === "function" ? addFormatsModule : addFormatsModule.default;

export interface BuildReportModelParams {
  auditId: string;
  locale: "en" | "ar";
  secretHash: string;
  expiresAt: string | null;
  summaryBullets: string[];
  findingIds: string[];
  limitationsKeys: string[];
  pagesChecked: number;
  sampled: boolean;
  findings: StoredFinding[];
}

export function buildReportModel(params: BuildReportModelParams): ReportModel {
  const withLineage = params.findings.filter((finding) => finding.evidence_ids.length > 0).length;
  return {
    report_id: randomUUID(),
    audit_id: params.auditId,
    version: 1,
    access_class: "anonymous",
    languages: [params.locale],
    allowed_projections: ["web_interactive"],
    access: {
      link_id: params.auditId.replace(/-/g, ""),
      secret_hash: params.secretHash,
      noindex: true,
      public_gallery: false,
    },
    tone: "professional",
    content: {
      summary_bullets: params.summaryBullets,
      score_result_ids: [],
      finding_ids: params.findingIds,
      prompt_run_ids: [],
      roadmap_id: null,
      data_gaps: [],
      limitations_keys: params.limitationsKeys,
      sample_disclosure: {
        pages_checked: params.pagesChecked,
        sampled: params.sampled,
      },
    },
    lineage_coverage: {
      numbers_total: withLineage,
      numbers_with_lineage: withLineage,
      ratio: 1,
    },
    status: "ready",
    needs_native_review: false,
    retention_days: 7,
    created_at: new Date().toISOString(),
    expires_at: params.expiresAt,
  };
}

export function validateReportModel(report: unknown, schemasDir: string): void {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  // The schema files carry URN $ids ("urn:wpi:schema:..."). Ajv 8 resolves
  // $refs with fast-uri, which cannot resolve the relative
  // "common.schema.json#..." refs against a URN base ("URN without nid
  // cannot be serialized"), so the $ids are stripped from the in-memory
  // copies and the filename keys act as the reference base. The schema
  // files on disk are not modified.
  const common = JSON.parse(
    readFileSync(join(schemasDir, "common.schema.json"), "utf-8"),
  ) as Record<string, unknown>;
  delete common["$id"];
  ajv.addSchema(common, "common.schema.json");
  const schema = JSON.parse(
    readFileSync(join(schemasDir, "report-model.schema.json"), "utf-8"),
  ) as Record<string, unknown>;
  delete schema["$id"];
  const validate = ajv.compile(schema);
  if (!validate(report)) {
    const details = (validate.errors ?? [])
      .map((error) => `${error.instancePath} ${error.message ?? "is invalid"}`)
      .join("; ");
    throw new Error(`Report model failed schema validation: ${details}`);
  }
}
