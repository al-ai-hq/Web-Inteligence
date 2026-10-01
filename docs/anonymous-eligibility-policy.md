# Anonymous eligibility policy

Status: draft for review
Owner role: Security owner (with the Product owner, Privacy owner and Cloud billing owner), matching `config/anonymous-eligibility.yaml`
Sources: 01-PRODUCT-REQUIREMENTS §5.0, §5.19, §9, §11, §12, §15; 04-CLAUDE-CODE-BUILD-PROMPT §3.1, §13, §19; 05-PROJECT-PLAN §1.1, M0, M0B, M3, M4, §7; 09-MERGE-DECISIONS (preserved V3 decisions); 02-DETAILED-SPECIFICATION §12, §18; v1-baseline §6.5, §9.9, §11, §13.3; docs/decisions.md D-002, D-004, D-005, D-006, D-007
Last updated: 2026-09-30

## 1. Purpose

Phase 1 needs no account, email or payment. Every low-risk visitor is eligible for one
complimentary comprehensive public-data audit (01 §5.0). This policy decides how rich each
anonymous audit is, using privacy-conscious signals, and how abuse and budget controls override
that decision (01 §5.19). Values live in `config/anonymous-eligibility.yaml`. This
document states intent; the config file states names and numbers. If they disagree, raise it and
do not ship until one of them is corrected.

## 2. Principles

1. The deterministic core always comes first: evidence, Presence Readiness, findings and the
   action plan are preserved before optional AI observations or enrichment (01 §5.19).
2. Signals can lower or delay a tier. They never raise it above what the visitor is eligible for.
3. An IP address is a rate signal, never a person (01 §5.19, 04 §3.1).
4. Every downgrade, challenge or refusal is visible to the user with a plain reason category.
5. A sample is never presented as full coverage, in any tier.
6. No anonymous tier offers any export or download (D-002).

## 3. Tiers

Sizes are configuration (D-006). Values below mirror `config/anonymous-eligibility.yaml`
(version 0.1.0-draft) and are ASSUMPTIONS until the M0B cost proof (`docs/cost-model.md` §7)
confirms them. Rows the config does not yet hold are marked "proposed".

| | `rich` | `reduced` | `preview` | `refused` |
|---|---|---|---|---|
| When | First audit in this browser, low risk, budget normal | Second audit in this browser, or rich downgraded by risk or budget | Later audits in this browser, or reduced downgraded | Unsafe target, active abuse, or intake closed by a global breaker |
| Crawl scope | Up to 20 representative pages (D-006) | ASSUMPTION: up to 10 representative pages (half the rich default) | ASSUMPTION: 1 page, the quick single-page mode (04 §5) | None |
| Presence Readiness | Yes, with coverage and confidence | Yes, with coverage and confidence | Yes, shown with low confidence and "checked X of Y" | No |
| Experience Effectiveness | Yes, `assessed`, with confidence | No (ASSUMPTION: omitted to control cost) | No | No |
| Performance, accessibility, public-footprint and template findings | Yes | Yes | No | No |
| Comparison | One equivalent competitor or dual-URL comparison (01 §5.0) | No (ASSUMPTION) | No | No |
| AI observations | 8 prompts x configured providers x 1 run, shown as counts (D-006; `config/prompt-panels/free-panel.yaml`) | No new observations (ASSUMPTION); valid recent observations for the same domain may be shown with their original capture time | None | None |
| Action board and roadmap | 8-12 evidence-linked actions and a preliminary 30/60/90 roadmap | 8-12 actions and a preliminary roadmap | ASSUMPTION: up to 3 top actions, no roadmap | None |
| Paid-call cap per audit (proposed) | Soft USD 3.00, hard USD 4.00 (D-007) | USD 0 for AI observations; any other paid call `<DECIDE_AT_M0B>` | USD 0 (ASSUMPTION) | USD 0 |
| Retention | 7 days maximum (D-002) | 7 days maximum | 7 days maximum | No audit is created; only counters |
| Exports | None | None | None | n/a |

Counting window: the cookie lifetime is `<DECIDE_AT_M0>` in `config/retention.yaml`, with legal
review of whether it counts as essential (v1-baseline §9.9). ASSUMPTION for planning: 30 days.
`refused` shows a retry-after time (`<DECIDE_AT_M0: retry-after period>` in config).

Milestone availability: the full rich scope needs later milestones (Experience Effectiveness M5,
AI observations M6, public footprint M7). Until a module is enabled, its section shows
`unavailable` with the reason "not yet available", never an empty or zero result.

## 4. Signals

Only these signals are used. Each is documented, minimal and first-party. Config IDs in brackets.

| ID | Signal | How it is collected | Privacy limits | Used for |
|---|---|---|---|---|
| S1 | Signed first-audit cookie (`signed_first_audit_cookie`) | First-party cookie set by our site: version, issue time, counts of rich and reduced audits used, key ID and signature. HttpOnly, Secure, SameSite | Holds counters, not a cross-site identifier. ASSUMPTION: no server-side profile keyed by the cookie. Counsel confirms whether it is strictly necessary (`docs/legal/README.md`) | Promotional tier |
| S2 | Recent-domain state (`recent_domain_audit_state`) | Keyed hash of the normalized target domain with recent audit times and evidence freshness | No visitor identity attached | Evidence reuse; per-domain rate limit (protects the target site too) |
| S3 | Request velocity (`request_velocity`) | Counters per keyed hash of the IP address (IPv4) or /64 prefix (IPv6), per domain, and global, over short windows. ASSUMPTION on prefix sizes, decide at M0B | Counters only; security-log retention 30 days (v1-baseline §10) | Escalation to challenge or slower queue |
| S4 | Automation indicators (`automation_indicators`) | Server-observable request properties, a first-party form token, and the challenge result when a challenge is shown | No client-side fingerprinting scripts | Escalation |
| S5 | Limited network-risk signals (`limited_network_risk`) | A short documented list, for example edge security signals from Cloud Armor. Exact sources `<DECIDE_AT_M0B>` | Never used alone to refuse | Escalation to challenge |

## 5. Fairness for shared IPs

Many real people share one address: offices, universities, mobile carriers, public Wi-Fi.

- IP-based velocity may trigger a challenge or a slower queue. On its own it never moves a
  visitor below the tier their own browser state earns (ASSUMPTION in
  `config/anonymous-eligibility.yaml`), and it never refuses a first audit.
- Thresholds are sized for shared networks. ASSUMPTION: set from staging and pilot data, reviewed
  monthly; the first values are `<DECIDE_AT_M0B>`.
- A browser that has not used its rich audit keeps rich eligibility even when its IP is busy,
  subject to a challenge and the budget state.
- Losing the cookie (cleared browser, private window) makes the visitor look new. This is
  accepted; the budget controls bound the cost.
- The challenge must have an accessible alternative (WCAG 2.2 AA target, 01 §9). If a visitor
  cannot complete it, the fallback is the slower queue, not refusal.
- Downgrade or temporary refusal needs more than IP velocity: automation indicators, a network-risk
  signal, or a failed challenge. Any refusal is temporary and shows when to retry.

TS-ELIG includes shared-IP cases: many first-time browsers behind one address must still get
first audits within the configured limits.

## 6. Decision order

Higher rules override lower ones (01 §5.19: global safety and spending breakers override
first-audit eligibility). The order follows `decision_order` in the config.

1. **Global safety breakers**: intake closed for an incident or crawl capacity. Result: queued
   with an estimate if the queue is open, otherwise `refused` with a retry time.
2. **URL safety and legal**: the URL fails validation (unsafe or private target: security
   rejection, v1-baseline §6.4), or an active abuse block applies. Result: `refused`.
3. **Global spending breakers** (`docs/cost-model.md` §5, §6). The config fixes only the 100%
   step and leaves the others as `<DECIDE_AT_M0: degradation step at which new anonymous audits
   are capped at reduced, then preview, then refused>`. The rows below are the proposal
   (ASSUMPTION):

   | Budget state | Effect |
   |---|---|
   | Normal | No change |
   | Pressure (forecast 85% or more) | Rich audits drop optional enrichment and repeat observations |
   | Anonymous daily allowance short, or forecast 95% | Rich becomes reduced (no new AI observations) |
   | Paid-call budget exhausted | No paid calls in any tier; deterministic audits continue; AI sections read "unavailable: monthly limit" |
   | Hosting forecast at cap minus reserve | New anonymous intake closes: `refused` with a capacity reason |

4. **Suspicious request** (S3, S4, S5): challenge first; then slower queue, reduced scope or
   temporary refusal (01 §5.19). IP velocity alone stops at the challenge or slower queue (§5).
   Thresholds: `<DECIDE_AT_M0>` in config, calibrated in staging.
5. **Promotional eligibility** (S1): no rich audit used, `rich`; rich used, `reduced`;
   reduced used, `preview`.
6. **Evidence reuse** (S2): if valid public evidence for the same domain exists within its
   freshness window (`config/freshness.yaml`), reuse it and disclose the capture time. Reuse only
   records built without visitor-supplied inputs. Never present a reused AI observation as new
   (v1-baseline §11.2).
7. **Record** the tier and reason codes on the audit. Product analytics records the eligibility
   class without identifiers (01 §11).

## 7. What users see

All messages are written natively in Arabic and English, not mechanically mirrored (04 §2). Message intent:

| Situation | The user sees |
|---|---|
| `rich` | The full report; a scope line "N representative pages checked out of M found; not full coverage"; AI observations as counts with numerators and denominators; the expiry date; a delete button; no download controls |
| `reduced` | The report with a banner naming the reason category ("this browser has used its complimentary full audit" or "reduced because of current demand"), what is reduced, and what registration adds (M4+) |
| `preview` | A short report with the same banner style and a clear statement that this is a preview |
| Challenge | A short human check with an accessible alternative |
| Slower queue | Honest queue status; no invented wait times |
| `refused` | "We cannot start this audit right now", a reason category (unsafe address, temporary limit, service capacity), when to try again, and no blame |
| Evidence reused | "Some evidence was captured at <time> and reused" |
| Section not available | The section, marked `unavailable`, with the reason (monthly limit, provider unavailable, not yet available) |

Screenshots and printing work normally. The product does not block them with
accessibility-hostile techniques (04 §3.1).

## 8. What never happens

- Invasive cross-site fingerprinting: canvas, WebGL, audio or font probing, device-fingerprint
  libraries, third-party cookies or cross-site identifiers (01 §5.19).
- Treating a shared IP address as one person.
- Any anonymous export: PDF, document, CSV, JSON, raw evidence, task list or full-report copy.
  Denied server-side on every route (D-002, 01 §12).
- An email gate or a required account for the first audit (01 §5.0).
- Hiding that scope was reduced, or presenting a sample as full coverage.
- Showing a skipped provider or a budget stop as a 0% result (v1-baseline §11.4).
- Using eligibility signals for marketing, profiling or sale.
- Publishing an anonymous audit to the gallery (04 §3.1).
- Treating possession of a report link as proof of domain ownership (D-004).

## 9. Config contract

`config/anonymous-eligibility.yaml` is the machine-readable form of this policy.

Present in version 0.1.0-draft: tier definitions and scopes, allowed and prohibited signals,
IP-address rules, decision order, escalation (challenge only when suspicious), budget overrides
(100% step fixed, others open), registration triggers, retention reference.

Still to add before M3 (owner: config owner; tracked as open items):

- per-tier paid-call caps (only the rich cap exists, in `config/budgets.yaml`);
- cookie name, signing-key reference (a secret name, never the value) and counting window;
- velocity windows, thresholds, IP aggregation prefix sizes and per-domain limits;
- the budget-state to tier mapping (§6 step 3) once decided;
- reason codes and their user-facing message keys in both languages;
- evidence-reuse window (`config/freshness.yaml` holds `anonymous_evidence_reuse` as `<DECIDE_AT_M0>`).

## 10. Tests

| Suite | Proves |
|---|---|
| TS-ELIG | First, second, later and suspicious pathways; shared-IP fairness; cookie loss; tampered cookie; evidence reuse without visitor-context leakage; challenge escalation and accessible fallback; per-domain limits |
| TS-COST | Budget states change tiers as §6 says; hard stop; anonymous sub-budget holds under a scripted abuse run |
| TS-ANON-ACCESS | Unguessable link, signed secret, noindex, 7-day expiry, deletion, claim after registration without ownership |
| TS-ANON-EXPORT | Every anonymous export attempt is denied server-side |
| TS-E2E, TS-A11Y-MANUAL | Messages in both languages; challenge alternative is usable by keyboard and screen reader |

01 §12 acceptance: "one rich, second reduced, later preview, and suspicious-request pathways
preserve their defined value and cost controls."

## 11. Open decisions

- Confirm the reduced and preview scopes in config (ASSUMPTIONS); decide velocity thresholds,
  IP prefix sizes, network-risk sources, cookie lifetime, counting window and retry-after period
  (`<DECIDE_AT_M0>` in config).
- `<DECIDE_AT_M0B: CAPTCHA provider>` (02 §12 names reCAPTCHA Enterprise; it adds a subprocessor and needs counsel review).
- `<DECIDE_AT_M0B: anonymous sub-budget share>` (`docs/cost-model.md` §6).
- Whether Phase 1 anonymous launch waits for M5 to M7 so the rich audit is complete, or launches
  with those sections `unavailable` (01 §5.0 lists them in the first audit; 05-PROJECT-PLAN builds them in M5 to M7).
