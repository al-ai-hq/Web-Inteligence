# Spec: M0B contracts, threat model and cost proof

| Field | Value |
| --- | --- |
| Intent | `intent/INT-01-m0b-contracts-threat-model-cost-proof/intent.md` (status: accepted) |
| Status | approved |
| Author | Cursor session (Grok 4.7), 2026-10-01 |
| Product owner sign-off | Ibrahim, 2026-10-01, by the message "I approve spec.md". The product-owner role name remains `<DECIDE_AT_M0: name>` (OI-002). |
| Policy owner sign-offs | pending: security engineer (security-baseline), data engineer (data-integrity), cloud billing owner (cost-guard), integration engineer (connector-safety), SEO lead (google-search-guidance) |
| Spec prompt version | `.claude/skills/intent-spec-plan/SKILL.md` stage 2, skill version 0.1.0 |
| Skill versions | intent-spec-plan 0.1.0; security-baseline 0.1.0; data-integrity 0.1.0; cost-guard 0.1.0; connector-safety 0.1.0; google-search-guidance 0.1.0; arabic-rtl-a11y 0.1.0; marketing-seo-agent vendored snapshot 2026-09-30 (no version field in its SKILL.md) |
| Source sections read | `AGENTS.md`; `CLAUDE.md`; `docs/spec/00-READ-ME-FIRST.md`; `docs/spec/03-PRODUCTION-CONTRACTS.md`; `docs/spec/04-CLAUDE-CODE-BUILD-PROMPT.md` §7.1, §24; `docs/spec/05-PROJECT-PLAN.md` §11; `docs/spec/06-MODEL-PLAN.md` §3, §8; `docs/state-machines.md`; `docs/threat-model.md`; `docs/iam-matrix.md`; `docs/cost-model.md` §7; `docs/retention-deletion-map.md`; `docs/decisions.md` D-002, D-005, D-007, D-012, D-014, D-019, D-020, D-021; `docs/open-items.md` OI-001, OI-021, OI-031, OI-036, OI-040; `docs/assumptions.md` A-003; `config/budgets.yaml`; `config/scoring.yaml`; `config/agents/`; `schemas/` including the seven records without `project_id`; `scripts/check_schemas.py`; `scripts/check_config.py`; `intent/INT-00-m0a-repository-bootstrap/release.md` |

Status values: `draft`, `changes_requested`, `approved`, `superseded`. Only the product owner sets `approved`.

## Summary

M0B shows that the existing contract drafts hold together for five local proofs. A check reproduces one Presence Readiness score from stored rule results, rejects one invalid report, traces one report number to evidence, denies one anonymous CSV export, and refuses the next paid call when paid calls reach the cap minus the reserve.

The drafts in `schemas/`, `docs/state-machines.md`, `docs/threat-model.md`, `docs/iam-matrix.md`, `docs/cost-model.md`, and `docs/retention-deletion-map.md` stay the starting material. This milestone adds the parent-join rules those proofs need and the fixtures the checks read. It does not deploy a service, call a provider, change rule weights, or reopen M0A.

Cursor runs the work beside Claude Code. `.claude/` remains the policy source. The session model is the name the picker shows. `fable` at xhigh is not a Cursor picker value (D-020).

## Requirements

### Functional

1. A local proof command exits 0 only when all five checks below pass, and exits non-zero when any one fails. The command, fixture path, and reviewer are what `release.md` will record. The reviewer is a person who did not author the fixture. Source: accepted intent exit gate; `docs/spec/05-PROJECT-PLAN.md` §11.
2. Reproduce one score. The fixture holds seven scored rule results, one in each Presence Readiness category, each with `importance_weight` 1 and result `pass` (value 1.00). Rule IDs are `CRW-001`, `SEO-001`, `STR-001`, `AEO-001`, `GEO-001`, `I18N-001`, and `PRF-001`. The check recomputes each category score as 100 and the pre-cap Presence Readiness as 100, using `config/scoring.yaml` weights 20, 15, 10, 20, 15, 10, 10 and `methodology_version` `0.1.0-draft`. No critical cap applies. Experience Effectiveness, AI visibility, and search performance are absent from this fixture. Source: accepted intent; D-012; `config/scoring.yaml` formulas.
3. Reject one invalid record. The valid `schemas/examples/report-model.example.json` passes schema validation. The patched record defined by `schemas/examples/invalid/report-model.ready-without-full-lineage.invalid.json` fails validation. Source: accepted intent; `scripts/check_schemas.py`.
4. Trace one report number. A fixture `ReportModel` headline value 100 carries fidelity `computed`, which maps to evidence state `verified` without erasing `computed`. The headline points at the `ScoreResult` from requirement 2, that score points at the seven `RuleResult` rows, and the `CRW-001` result points at one `EvidenceObject` with fidelity `observed`. Removing any link fails the check. Source: `docs/spec/03-PRODUCTION-CONTRACTS.md` "Evidence and fidelity"; data-integrity skill.
5. Deny one unauthorized export. For an anonymous requester and format `csv`, the check returns decision `denied`, denial reason `anonymous_export_prohibited`, and creates no artifact. The existing negative example `schemas/examples/invalid/export-authorization.anonymous-authorized.invalid.json` still fails validation. The same command also asserts that `config/agents/fixer.yaml` `tools` contains none of `apply_change`, `publish`, `write_cms`, `delete_content`, `upload_disavow`, `send_email`, `submit_form`. The recorded exit proof is the export denial. Source: D-002; `schemas/export-authorization.schema.json`; connector-safety skill.
6. Simulate the USD 150 hard stop. Money values are decimal strings plus currency `USD`. `hard_cap` is `150.00`. Reserve is `10.00` (assumption A-003). The pre-call check refuses a proposed paid call when `paid_calls_to_date + proposed_call` is greater than `140.00`. A proposed call that lands on `140.00` is allowed. The refuse fixture has paid calls to date `140.00` and a proposed call `0.01`. The allow fixture has paid calls to date `139.99` and a proposed call `0.01`. On refusal, the AI-visibility section is `unavailable` with the monthly-limit reason, and the Presence Readiness value from requirement 2 is still present. An estimated hosting line of `25.00`, fidelity `estimated`, is stored on its own line and does not stop hosting. Source: D-019; `docs/cost-model.md` §7 Stage 1; `config/budgets.yaml`.
7. Parent-join rules are written for the seven schemas that have no `project_id`, and a check enforces them. No `project_id` field is added to those schemas in this milestone. Source: D-014; OI-040.
8. Existing schema files, agent allowlists, scoring weights, `config/budgets.yaml` caps, and the M0A toolchain stay in place except for the fixture and proof files this spec names. `methodology_version` stays `0.1.0-draft`. Source: accepted intent; D-021.

### Non-functional

1. Proofs run on the local machine and in the existing GitHub Actions `governance` job. They do not deploy, call a provider, apply Terraform, or use a production credential. Source: accepted intent; D-019.
2. Fixtures contain synthetic IDs only. They contain no secrets, tokens, emails, raw page text, or live customer URLs. Source: security-baseline skill.
3. Anonymous export denial is evaluated in the proof, including a direct request. The in-app web report is not an export. Source: D-002; `docs/state-machines.md` §8.
4. The combined cap remains an assumption and is labelled unconfirmed in the proof output. Per-audit soft `3.00` and hard `4.00` stay assumptions and are not the hard-stop threshold. Source: D-005; D-007; OI-001.
5. There is no screen in this milestone. Arabic copy and WCAG evidence are not produced. `config/scoring.yaml` display names are not edited. Source: arabic-rtl-a11y skill; accepted intent.
6. `pnpm test:ssrf` and `pnpm test:e2e` stay placeholders recorded as not run. Source: D-021.

## Design

### Components and boundaries

The proof runner is a Python script beside `scripts/check_schemas.py`. It uses the standard library and the `jsonschema` package that script already requires. It adds no npm dependency and does not import `.claude/skills/marketing-seo-agent/scripts`.

Trust boundaries in the fixtures:

- Report numbers and evidence records are data. Instruction-like strings in an evidence fixture do not change the score.
- The export check is the policy decision. It is not a browser control.
- Agent YAML is read-only input. The proof does not grant a tool.
- The cost check reads `config/budgets.yaml` and synthetic ledger entries. It does not call Cloud Billing or a model provider.
- The crawler egress text already in `docs/threat-model.md` and `docs/iam-matrix.md` stays documentary. This milestone does not open a network path.

The GitHub Actions `governance` job gains one step that runs the proof script. The M0A toolchain versions are unchanged.

### Data contracts

No schema in the minimum set is renamed or version-bumped. The seven records keep their current `$id` version `0.1.0`.

Parent-join rules, checked against a fixture set:

| Record | Parent | Rule |
| --- | --- | --- |
| `Approval` | `ChangeSet` | `change_set_id` equals that change set. The project is `ChangeSet.project_id`. |
| `Snapshot` | `ChangeSet` | Same join as `Approval`. |
| `Verification` | `ChangeSet` | Same join as `Approval`. |
| `ChangeOperation` | `ChangeSet` | `op_id` appears in that change set's `operations` array. An `op_id` in none or in two change sets fails. |
| `ReportModel` | `Audit` | `audit_id` equals that audit. When `Audit.project_id` is a UUID, that is the project. When it is null, the audit is anonymous and a project query does not return the report. |
| `DeletionRequest` | subject | `subject_type` `audit`, `report`, `evidence_object`, `export_file`, or `keyword_upload` joins to that record and then to its project. `subject_type` `project` uses `subject_id` as the project. The M0B fixture uses `audit`. `user_account` is not in the fixture. |
| `WebhookEvent` | `Audit` | There is no Site schema. `site_id` equals `Audit.site_id`, and the project is that audit's `project_id`. A null `site_id` belongs to no project. Two audits with the same `site_id` and different `project_id` values fail the check. |

The join table lives in the proof fixture, not in a new `config/*.yaml`, so `scripts/check_config.py` does not gain an unschema'd file.

Score and report records use the lineage fields already required by their schemas. The score's fidelity is `computed`. The evidence object's fidelity is `observed`. Integrity state for the scored rules is `valid`.

### State transitions

`docs/state-machines.md` is not rewritten. Retry counts, timeouts, and expiry windows stay assumptions. This milestone does not calibrate them and does not add a deletion demonstration.

The export proof uses the existing denial transition: an anonymous request ends `denied` with reason `anonymous_export_prohibited` (`docs/state-machines.md` §8, row E3). No other transition is executed.

The cost proof uses the existing skip on the monthly hard stop: AI observations become `unavailable`, and the deterministic score still completes (`docs/state-machines.md` rows A9 and A10). No workflow engine is started.

### Configuration

`config/budgets.yaml`, `config/scoring.yaml`, and `config/agents/*.yaml` are read and not edited.

The proof reads:

- monthly `hard_cap` `150.00`, `currency` `USD`, `reserve` `10.00`, `paid_calls_stop_at` `cap_minus_reserve`;
- `methodology_version` `0.1.0-draft` and the seven category weights;
- `fixer` `tools` and `forbidden_tools`.

No model ID, price, quota, or crawler token is added (D-010). `hosting_overrun` stays `<DECIDE_AT_M0: ...>`.

### UI (if any)

None. No Arabic or English screen. No mock.

## Policy conformance

| Policy skill | Applies? | How the design complies | Concern for owner |
| --- | --- | --- | --- |
| google-search-guidance | Yes, by exclusion | No rule, weight, or report wording changes. The score fixture does not score `llms.txt`, require FAQ markup, or promise a rich result. Skill scripts are not imported. | SEO lead: weights and the SPAM-001 cap stay unsigned. |
| security-baseline | Yes | Export denial is in the proof. Fixtures have no secrets. Parent joins keep project scope. No fetch is added, so the SSRF placeholder stays not run. | Security engineer: WebhookEvent joins through Audit because no Site schema exists. Null `site_id` is unscoped. |
| arabic-rtl-a11y | No surface | No screen, copy, or PDF. Display names in `config/scoring.yaml` stay as they are, including `needs_native_review`. | Arabic reviewer: nothing new to review at this milestone. |
| data-integrity | Yes | The score recomputes from rule results. The report number traces to evidence. `computed` maps to `verified` and is kept. Missing links fail. Categories are not blended. | Data engineer: the zero-denominator category placeholder stays open and is outside the fixture. |
| cost-guard | Yes | The hard stop is a pre-call check on synthetic entries. Refusal yields `unavailable`, not 0. Hosting is a separate estimated line. Product spend is `0.00` USD. | Cloud billing owner: D-005 and the USD 10 reserve stay assumptions. Hosting is not part of the `140.00` threshold. |
| connector-safety | Yes | The recorded denial is the anonymous export. The same command checks that `fixer` has no write-class tool. No connector is selected and no write is sent. | Integration engineer: the first connector stays open. The approval model stays the existing generic schema. |

## Areas of concern

1. D-005 is unconfirmed. The proof can show a stop at `140.00` and still be wrong if the owner later splits hosting from paid calls. The output must say the cap is an assumption.
2. The stop threshold ignores the estimated hosting line. A real month could pass USD 150 while paid calls stay at or under `140.00`. That is the open hosting-overrun decision (OI-031). The proof must not claim hosting is protected.
3. Anonymous backups can outlive 7 days (OI-036). This spec does not resolve it and does not add a deletion proof. `docs/retention-deletion-map.md` §8 asks for a deletion demonstration at M0B; the accepted intent keeps that out of the exit.
4. `docs/state-machines.md` asks to calibrate retries at M0B with load tests. The accepted intent leaves those numbers as assumptions.
5. Seven schemas still have no `project_id`. The join rules are the D-014 resolution for this milestone. A later milestone may add the field. Until the check exists, isolation for those records is documentary.
6. `WebhookEvent` has `site_id` and the repository has no Site schema. Joining through `Audit` is a stand-in. A webhook whose site has no audit in the fixture fails closed.
7. M0A `release.md` is still `draft`, and the GitHub Actions `secrets` job failed on the gitleaks organization licence (OI-021). That does not reopen M0A. The new proof step cannot turn a red `secrets` job green.
8. Named owners do not exist (OI-002). Independence is "did not author the fixture" until names are set.
9. `docs/spec/03-PRODUCTION-CONTRACTS.md` still describes a Claude Code build only. D-020 puts Cursor beside it. This spec does not edit 03.

## Test and eval plan

The proof script is the test. Fixtures live under `evals/m0b/` and use synthetic UUIDs.

| Check | Fixture | Pass condition |
| --- | --- | --- |
| Score | `evals/m0b/score-fixture.json` | Recomputed pre-cap Presence Readiness is 100 at `methodology_version` `0.1.0-draft` |
| Invalid record | `schemas/examples/report-model.example.json` and `schemas/examples/invalid/report-model.ready-without-full-lineage.invalid.json` | Base validates; patched record does not |
| Trace | `evals/m0b/trace-fixture.json` | Headline 100 links score, rule result, and evidence; a missing link fails |
| Export denial | `evals/m0b/export-fixture.json` plus the existing anonymous-authorized negative example | Decision `denied`, reason `anonymous_export_prohibited`, no artifact; negative example still invalid; `fixer` tools have no write-class name |
| Hard stop | `evals/m0b/cost-fixture.json` | `140.00` + `0.01` is refused; `139.99` + `0.01` is allowed; AI section `unavailable`; Presence Readiness 100 remains; hosting `25.00` stays `estimated` |
| Parent join | `evals/m0b/project-joins.json` | Each of the seven rules resolves one valid parent and rejects one broken parent |

`pnpm test:ssrf` and `pnpm test:e2e` are not these checks. Golden files, product-agent evals, and build-agent evals are not run. No browser journey is run.

`scripts/check_schemas.py` and `scripts/check_config.py` still pass after the proof files are added. Those commands are part of implementation proof later. They were not re-run while this spec was written.

## Rollout and rollback

No feature flag and no environment. The change is repository files: the proof script, `evals/m0b/` fixtures, and one `governance` job step.

Rollback is `git revert` of the M0B commits. No service, schema migration, or cloud resource is created. Staging rehearsal is not run.

The monitoring signal is a green proof step in the `governance` job. The `secrets` job remains outside this milestone's control until OI-021 is decided.

## Cost

Paid calls added: none. Hosting added: none. Product spend against the USD 150 cap: `0.00` USD.

The hard-stop fixture is synthetic. The reserve `10.00` and the per-audit caps stay assumptions. Session usage for writing this spec is build cost, separate from the product cap (`docs/spec/06-MODEL-PLAN.md` §6).

## Assumptions and open items

- ASSUMPTION: D-005 combined cap, labelled unconfirmed. Do not rewrite D-005.
- ASSUMPTION: reserve `10.00` USD (A-003). Paid-call stop line is `140.00`. A proposed call is refused only when the sum is greater than `140.00`.
- ASSUMPTION: D-007 per-audit soft `3.00` and hard `4.00`, unused as the monthly stop line.
- ASSUMPTION: estimated hosting in the fixture is `25.00` USD and is not added to the `140.00` threshold.
- ASSUMPTION: retry and timeout numbers stay as written in `docs/state-machines.md`.
- Open: OI-001, OI-002, OI-021, OI-031, OI-036, OI-040 as the join-rule work this milestone does, region, identity provider, first connector, weight sign-off, zero-denominator category score, Stage 2 measured cost.
- Copy forward at implementation, without rewriting earlier rows: one assumption line for the `140.00` comparison if it is not already A-003, and a note that OI-001 does not block Stage 1. Do not close OI-001.
