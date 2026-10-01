# Legal texts required before launch

Status: draft for review (index only; no legal text is drafted here)
Owner role: Counsel
Sources: 01-PRODUCT-REQUIREMENTS §4, §5.0, §5.17, §9, §14; 04-CLAUDE-CODE-BUILD-PROMPT §3.1, §13, §19; 05-PROJECT-PLAN M12, M13; 02-DETAILED-SPECIFICATION §14, §17; v1-baseline §9, §10, §18 Phase 7, §22; docs/decisions.md D-002, D-003, D-005
Last updated: 2026-09-30

## Statement

**These texts are not drafted in this repository and need qualified counsel.** The service operates
worldwide and in several Arabic-speaking markets, so each text needs review for every market served
(v1-baseline §9, 02 §17). Nothing in this folder, in `docs/data-classification.md` or in
`docs/retention-deletion-map.md` is legal advice. Engineering documents describe what the product
does; counsel decides what the product must say and promise.

Launch gate: v1-baseline §18 Phase 7 requires "legal text approved" before controlled launch, and
05-PROJECT-PLAN M13 requires provider and legal review.

## Required texts

| Text | Needed by | Must cover (inputs, not wording) | Inputs available |
|---|---|---|---|
| Privacy policy | Anonymous launch | The 13 sections in v1-baseline §9.10: operator identity and contact; data categories; sources; purposes and lawful bases; recipients including AI providers; international transfers; retention schedule; security practices; user rights and request procedure; cookies and analytics; children; automated processing; update procedure and effective date | v1-baseline §9.1-§9.11; `docs/data-classification.md`; `docs/retention-deletion-map.md`; provider list in `config/providers.yaml` |
| Terms of service | Anonymous launch | What an audit is and is not (no ranking, traffic, citation or revenue guarantee, 01 §4); acceptable use, including auditing only public pages and no abuse of the service; private links and 7-day expiry (D-002); no anonymous exports; eligibility tiers may change with risk and budget (01 §5.19); results are evidence-labelled observations, not professional legal, medical, financial, accessibility or security advice (01 §4); limits on AI observations (API observations, not consumer-app reproductions, 02 §6) | 01 §4, §5.0, §5.19; `docs/anonymous-eligibility-policy.md` |
| Data processing agreement (DPA) | Before any client connects a site (02 §17), M4 or M9 | Roles, processing instructions, subprocessors, security measures, retention (D-003), deletion and return, assistance with requests, breach notification, international transfers | `docs/data-classification.md`; `docs/retention-deletion-map.md`; `docs/iam-matrix.md`; `docs/threat-model.md` |
| Subprocessor list | Anonymous launch | Google Cloud; each external AI provider; identity provider; CAPTCHA provider; any email provider; any keyword-data provider; processing locations (02 §17, v1-baseline §9.7) | `docs/environments.md` §2; `config/providers.yaml`; open decisions below |
| Cookie notice and consent controls | Anonymous launch | The signed eligibility cookie and the report session cookie (whether they are strictly necessary is for counsel to confirm); any CAPTCHA cookies; non-essential analytics only after consent where required; a persistent preference control (v1-baseline §9.9) | `docs/anonymous-eligibility-policy.md` §4; `docs/retention-deletion-map.md` §3 |
| Public-gallery consent terms | M12 | Ownership verification; explicit opt-in; what is published and what is excluded; preview and redaction; revocation, removal, correction, expiry and re-consent; benchmark aggregation (01 §5.17) | 01 §5.17; 04 §13 |

## Other reviews counsel must complete

- Provider terms for storing and displaying AI answers, including Google grounded-result display
  and storage rules (02 §17, v1-baseline §10, §21).
- Keyword and rank data licences: display rights for licensed data shown to clients (02 §14).
- Crawler conduct: public statement about the crawler, its identification and robots behavior;
  complaint handling for the static egress IP.
- Whether anonymous backup copies beyond 7 days are compatible with the public "7 days maximum"
  statement (`docs/retention-deletion-map.md` §6).
- Response deadlines for privacy requests and breach-notification duties per market
  (`docs/runbooks/deletion-request.md`, `docs/runbooks/incident.md`).
- Whether a site owner may ask us to delete anonymous audits of their site requested by others.
- Children: the service is not directed to children (v1-baseline §9.11); confirm age wording.
- Retention for audit logs, approvals, snapshots and deletion receipts (12 months assumed, 02 §16
  says pending legal review).
- Content and regulated-claim policy for generated content (01 §14).

## Inputs from v1-baseline §9 and what changed

v1-baseline §9 is the drafting baseline, but V4 decisions override parts of it:

| v1 baseline | V5 position |
|---|---|
| Optional email address for report delivery (§9.2, §9.4) | No email for anonymous reports; the report stays in-app (D-002) |
| 30-day retention for anonymous reports and evidence (§10) | 7 days maximum (D-002) |
| PDF report for anonymous users (§10) | No anonymous exports of any kind (D-002) |
| Audit deletion from the report page (§9.6) | Kept |
| Provider disclosure before execution (§9.8) | Kept |
| Essential cookie only without consent (§9.9) | Kept; counsel confirms the eligibility cookie qualifies |

## Open decisions for the owner

- `<DECIDE_AT_M0: operator legal entity, country and privacy contact>` (v1-baseline §22).
- `<DECIDE_AT_M0: markets served at launch>` (drives which laws counsel reviews).
- `<DECIDE_AT_M0: identity provider>`, `<DECIDE_AT_M0B: CAPTCHA provider>`,
  `<DECIDE_AT_M0: runtime model providers>` (D-011): each is a subprocessor.
- `<DECIDE_AT_M0: region>` and transfer mechanisms.
