# Experience Effectiveness rubric

Status: draft for review (not calibrated; no weight is fixed)
Owner role: Methodology owner (with the Arabic editorial owner and a UX/conversion reviewer)
Sources: 01-PRODUCT-REQUIREMENTS §3, §4, §5.3, §5.18, §8 (Scoring), §12, §14; 04-CLAUDE-CODE-BUILD-PROMPT §2, §7.2, §20; 05-PROJECT-PLAN M5, M12; 02-DETAILED-SPECIFICATION §9 (writing rules), §15, §19; v1-baseline §6.3, §6.5, §14; docs/decisions.md D-006, D-012
Last updated: 2026-09-30

## 1. Purpose and boundaries

Experience Effectiveness is a separate, clearly labelled score across five dimensions: design
hierarchy and readability, copy and message clarity, UX and navigation, trust and proof, and
conversion path and measurement (04 §7.2). Subjective checks need a rubric, evidence, confidence
and a reviewer trace.

- It is never merged into Presence Readiness, and never blended with observed AI visibility or
  search performance (D-012).
- It never changes a Presence Readiness rule result. Where a criterion looks at the same page
  feature as a readiness rule (for example contrast or headings), the readiness rule is cited as
  evidence and is not scored twice inside readiness.
- It describes the sampled pages. It is never presented as a site-wide verdict.
- It predicts nothing: no conversion rate, revenue or uplift (01 §4).
- 05 M5 exit: rubric agreement and calibration reviewed; subjective results remain
  distinguishable from deterministic findings.

## 2. Result scale and fidelity

Each criterion returns a `rule_result`: `pass` (1.00), `partial` (0.50), `fail` (0.00),
`not_applicable`, `unavailable` or `error`, as in v1-baseline §6.3. `not_applicable`,
`unavailable` and `error` leave the denominator; the last two lower confidence.

| Kind of check | `fidelity_label` | User-facing `evidence_state` |
|---|---|---|
| Judgment against the rubric (model-assisted or human) | `assessed` | `inferred` |
| Deterministic sub-check on captured evidence (element present, position, count) | `observed` or `computed` | `verified` |
| Client confirmation (for example "conversion events are configured") | `attested` | `client_stated` |
| Source missing (for example no GA4 connection) | `unavailable` | `unavailable` |
| Check could not complete | n/a | `not_verified` |

## 3. Evidence package

The reviewer, human or model, sees only the evidence package captured by the crawler and the
render job. No live browsing during review, so every reviewer judges the same thing.

- Rendered screenshots at a mobile and a desktop viewport (sizes `<DECIDE_AT_M5>`; no config key
  exists yet).
- DOM extracts: heading outline, main navigation, links, calls to action, forms and their labels,
  script and tag inventory, visible text of the first sections.
- Relevant Presence Readiness results for the same page (as context, not re-scored).
- Page language and direction; both language versions when the site is bilingual.
- Business context supplied at intake (market, audience, offering).

Forms are inspected statically. The product never submits forms, creates accounts, orders or
books anything (02 §19).

## 4. Criteria

Every criterion weight and dimension weight is `<DECIDE_AT_M5>`. ASSUMPTION: calibration starts
with equal weights inside each dimension and equal dimension weights (20 each); this starting
point is for calibration only and is not a release value.

### 4.1 Design hierarchy and readability

| ID | Criterion | Evidence required | Pass | Partial | Fail |
|---|---|---|---|---|---|
| EXP-DH-01 | Main subject visible first | Screenshots at both viewports; position of the main heading | A heading that names the page's offer or topic is visible without scrolling at both viewports | Visible at one viewport only, or visible but generic | Not visible at either viewport, or no identifiable main heading |
| EXP-DH-02 | Visual hierarchy matches content hierarchy | Heading outline; screenshots; computed text styles | One clear primary heading; headings in logical order; the main action visually distinct from secondary actions | One of the three is weak | Two or more are missing |
| EXP-DH-03 | Readable body text | Computed font sizes, line lengths; readiness contrast results | Body text size, line length and spacing comfortable at both viewports; readiness contrast checks pass | Readable at one viewport only, or long unbroken text blocks | Text too small or too dense to read at mobile width |
| EXP-DH-04 | Mobile fit | Mobile screenshot; layout checks | No horizontal scrolling, overlapping or cut-off content at mobile width | Minor overlap or cut-off in secondary areas | Main content or main action broken at mobile width |
| EXP-DH-05 | Direction and mixed-script presentation (Arabic or bilingual pages only) | Screenshots; `lang`/`dir` attributes; rendered text | Correct direction and mirrored layout where appropriate; URLs, numbers and Latin terms isolated; Arabic text shaped correctly | Isolated errors (for example one mirrored icon or a mis-ordered number) | Wrong direction for the page, or broken shaping in main content. `not_applicable` for LTR-only pages |

### 4.2 Copy and message clarity

| ID | Criterion | Evidence required | Pass | Partial | Fail |
|---|---|---|---|---|---|
| EXP-CM-01 | Value proposition | Visible text of the first sections; intake context | States what is offered, for whom, and what makes it different, in the page language | Two of the three are clear | None or one is clear |
| EXP-CM-02 | Specific, checkable claims | Claim list extracted from visible text | Main claims are specific (numbers, scope, conditions) or supported on the page | Mix of specific and unsupported superlatives | Main message relies on unsupported superlatives ("best", "leading") |
| EXP-CM-03 | Clear next step | Call-to-action text and the surrounding copy | Action labels say what happens next | Generic labels ("Submit", "Click here") on secondary actions only | Main action label is generic or unclear |
| EXP-CM-04 | Language fit | Visible text; market and audience from intake | Written for the market's language and register; consistent terms; no untranslated fragments in main content | Minor inconsistencies or isolated fragments | Main content reads as mechanical translation, or mixes languages without purpose. Arabic judgments require native review during calibration |

### 4.3 UX and navigation

| ID | Criterion | Evidence required | Pass | Partial | Fail |
|---|---|---|---|---|---|
| EXP-UX-01 | Findable key sections | Navigation extract; link inventory | Main navigation reaches the key sections for the business type (offer, pricing where applicable, contact) with descriptive labels | One key section missing or vaguely labelled | Several key sections unreachable from navigation |
| EXP-UX-02 | Wayfinding | Titles, breadcrumbs, active states on sampled deep pages | The user can tell where they are and how to go up a level | Partial cues | No cues on deep pages. `not_applicable` for single-page sites |
| EXP-UX-03 | Mobile navigation | Mobile screenshot; menu markup; readiness keyboard results as context | Menu is present, labelled and keeps essential actions reachable | Menu works but hides an essential action | No usable navigation at mobile width |
| EXP-UX-04 | Language switch (bilingual sites only) | Link inventory; alternate-language links | Visible switch leads to the equivalent page in the other language | Switch leads to the other language's homepage | No visible switch. `not_applicable` for single-language sites |
| EXP-UX-05 | Load-time interruptions | First-load screenshots at both viewports | Main content visible on load | A dismissible overlay covers part of the content | An overlay or forced step blocks the main content before any information is shown |

### 4.4 Trust and proof

| ID | Criterion | Evidence required | Pass | Partial | Fail |
|---|---|---|---|---|---|
| EXP-TP-01 | Operator identity | Visible text; contact page; organization structured data | Who operates the site and how to reach them is clear | Name clear, contact route hard to find | Operator not identifiable |
| EXP-TP-02 | Attributable proof | Testimonials, case studies, certifications, client logos as captured | Proof items are attributed (named, dated or linked to a source) | Some items attributed | Proof present but unattributed, or no proof on pages whose purpose needs it. Never state that proof is fake; "unattributed" is the finding |
| EXP-TP-03 | Policies reachable | Link inventory | Privacy, terms and, for commerce, pricing, delivery and returns policies are reachable | Some reachable | None reachable on a site that collects data or sells |
| EXP-TP-04 | Current information | Visible dates and time-bound offers | Dates and offers on sampled pages are current or clearly historical | Isolated stale items | Main offer or main date is out of date |
| EXP-TP-05 | Data-collection transparency | Form markup and nearby text | Forms that collect personal data say what the data is used for | Stated on some forms | Not stated on any. `not_applicable` when no forms are found |

### 4.5 Conversion path and measurement

| ID | Criterion | Evidence required | Pass | Partial | Fail |
|---|---|---|---|---|---|
| EXP-CV-01 | Clear primary action | Call-to-action inventory; screenshots | Each sampled key page has one clear primary action, visible at mobile width | Primary action present but competing with several equal actions, or below the fold on mobile | No identifiable primary action on a page whose purpose needs one |
| EXP-CV-02 | Short visible path | Link graph from the crawl; form field counts | The action is reachable from key pages in few visible steps | Reachable but through a long or hidden path | Not reachable from the sampled pages |
| EXP-CV-03 | Form usability (static) | Form markup | Every field labelled; required fields marked; appropriate input types; field count fits the purpose. Error handling is `not_verified` because forms are not submitted | One weakness | Several weaknesses |
| EXP-CV-04 | Contact alternatives | `tel:`, `mailto:`, messaging and chat links | Alternatives the market context calls for are present | Some present | None where the business type needs them. `not_applicable` for self-serve-only products |
| EXP-CV-05 | Measurement present | Script and tag inventory; GA4 connection when available (M4+) | Analytics tag detected (`observed`) and, when connected or attested, conversion events configured | Tag detected; configuration `unavailable` or not attested | No analytics tag detected. Never claim events are configured without a connection or attestation |

## 5. Score, coverage and confidence

```text
dimension_score_d = 100 x sum(result_c x weight_c) / sum(applicable weight_c)
experience_effectiveness = sum over dimensions d of (dimension_score_d x dimension_weight_d)
coverage = measurable applicable weight / expected applicable weight
```

Weights: `<DECIDE_AT_M5>`. Show "checked X of Y" beside the score, as for readiness (02 §15).

Confidence (not a probability, v1-baseline §6.5). Thresholds are `<DECIDE_AT_M5>`; ASSUMPTION:
start from the v1 coverage thresholds (90% and 70%).

| Level | Per criterion | Overall |
|---|---|---|
| High | All required evidence present (both viewports; both languages when bilingual); the criterion met the agreement threshold in calibration | Coverage at or above the high threshold; at least the configured number of page types reviewed |
| Medium | One evidence item missing, or calibration agreement between the minimum and the high threshold | Coverage at or above the medium threshold |
| Low | Key evidence missing, single viewport only, or the reviewer flagged uncertainty | Anything lower |
| Not released | Calibration agreement below the minimum | The criterion is shown as `unavailable` ("not calibrated") and leaves the denominator |

## 6. Calibration protocol

No weight is fixed and no criterion is released until this protocol passes (01 §12:
"experience rubrics have evidence and reviewer calibration").

1. **Freeze a draft.** Version the rubric. For each criterion, write anchor examples for pass,
   partial and fail, taken from Phase 0 evidence.
2. **Calibration set.** Use the Phase 0 labelled sites (ASSUMPTION: 10 sites, 02 §19) with
   ASSUMPTION: homepage, two key pages and one conversion page per site, in both languages where
   the site is bilingual. Build the evidence package for each page.
3. **Two independent reviewers.** Two humans score every page blind to each other and to any model
   output. At least one has UX or conversion expertise. Arabic pages are scored by a native Arabic
   reader. Reviewers use only the evidence package.
4. **Agreement check per criterion.** Record exact agreement and a chance-corrected statistic
   suited to three ordered levels (ASSUMPTION: weighted Cohen's kappa). Report Arabic and English
   pages separately. Thresholds: `<DECIDE_AT_M5>`.
5. **Adjudicate and revise.** A third person (methodology owner) resolves disagreements. Rewrite
   ambiguous criteria, split or merge criteria, and re-run on pages not used for the rewrite.
   Maximum rounds: `<DECIDE_AT_M5>`.
6. **Drop or demote.** A criterion that cannot reach the threshold is removed or shown as
   advisory and unscored.
7. **Model-assisted reviewer.** Run the model-assisted reviewer (provider and model from
   `config/providers.yaml`, prompt version recorded) on the same packages. Compare with the
   adjudicated consensus per criterion. Release only criteria where agreement meets the threshold.
   Arabic criteria need their own agreement; English agreement does not carry over.
8. **Fix weights.** Only now the methodology owner sets criterion and dimension weights, bumps the
   methodology version and records the decision in `docs/decisions.md` (01 §14).
9. **Recalibrate** when the rubric changes, when the reviewing model or prompt changes, and on a
   drift check (ASSUMPTION: quarterly) using a held-out sample.

Evidence of each round (packages, scores, statistics, decisions) is kept with the M5 release
evidence. TS-RUBRIC checks that the recorded agreement meets the thresholds for every released
criterion.

## 7. Reviewer trace

Every judgment stores (field names follow `schemas/**`):

- rubric version and methodology version;
- criterion ID, page, and evidence IDs (screenshots, DOM extracts, readiness results used);
- result, a short rationale that cites the evidence, and confidence;
- reviewer type: model-assisted (provider, model ID from config, prompt version) or human
  (reviewer ID and role);
- page language and direction;
- time of review;
- any override: who, when, why, and the before and after values.

In the anonymous audit the reviewer is the calibrated model-assisted method; the report says so.
Human review for registered projects arrives with a later milestone (`<DECIDE_AT_M5>`).

## 8. Out of scope

- Roast or "light-roast" tone on regulated or sensitive contexts. ASSUMPTION list, confirm at M5:
  health and medical, finance and insurance, legal services, children, religion, government,
  charities and crisis services. Tone never changes facts, scores, severity or priority (01 §5.18).
- Named-person imitation or personal remarks about people shown on the site.
- Judging legal or regulatory compliance, or the accuracy of medical, financial or legal claims;
  those are flagged for professional review (01 §4).
- Taste judgments without a criterion (colours, style preferences).
- Conversion-rate, revenue or uplift predictions.
- Claims that reviews or testimonials are fake; the rubric can only say "unattributed".
- WCAG conformance claims; accessibility has its own checks and manual review.
- Anything behind a login, and any form submission, account creation, order or booking.
- Private competitor data.

## 9. Open decisions

- `<DECIDE_AT_M5>`: all weights, agreement thresholds, confidence thresholds, calibration rounds,
  viewport sizes, regulated-context list, human-review availability for registered projects.
- Anonymous-launch sequencing: 01 §5.0 lists Experience Effectiveness in the first anonymous audit,
  while 05-PROJECT-PLAN builds it in M5 (`docs/anonymous-eligibility-policy.md` §11).
