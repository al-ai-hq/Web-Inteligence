---
name: connector-safety
description: Applies risk tiers, exact approvals, snapshots, idempotency and read-back, and keeps writes inside the connector service. Use when designing, writing or reviewing connectors, change sets, approvals, publishing, rollback or webhooks.
---

# Connector safety (policy skill)

Status: draft for review. Version 0.1.0. Owner: integration engineer `<DECIDE_AT_M0: name>`. The owner signs off every change to this skill. A new connector write field also needs the integration lead's approval.

## When to use

- Connector adapters (`services/connectors`), change-set and approval code, webhook receivers.
- Fixer (V4 "change planner") and verifier features.
- Any plan item or UI that offers to apply, publish or roll back a change.

The first CMS or Git connector is an open decision (D-011): write `<DECIDE_AT_M0: first connector>` rather than guessing.

## Who may write

- Only the deterministic `connector` service holds write credentials and writes to a client site. No AI agent can apply or publish (02-DETAILED-SPECIFICATION §10, §13; 03-PRODUCTION-CONTRACTS "Agent tool boundaries").
- The fixer drafts field-level changes from structured fields; it has no apply tool. The verifier can request a rollback, not perform arbitrary writes.
- Write-class tool names never appear in an agent's `tools` list (`config/agents/*.yaml`).

## Approval boundaries (07-SKILLS-AND-AGENTS §6)

- Crawl consent does not grant CMS access. Read access does not grant write access.
- A report recommendation does not approve a change. Edit approval does not approve publication.
- One resource approval does not authorize a template or bulk change.
- A schedule does not authorize crossing a write gate. A successful canary does not authorize unlisted targets.
- Claiming an anonymous audit never proves domain ownership (D-004).

## Risk tiers

From 02 §10 and 03 "Change risk baseline". Tiers are versioned policy and need calibration before production.

| Tier | Examples | Approval | Rollout |
| --- | --- | --- | --- |
| 1 | Meta description, image alt text, Open Graph tags | One approver | Canary of 1-2 pages, read back, then bounded batches (ASSUMPTION: up to 25 pages) |
| 2 | Title, H1, JSON-LD, internal links, content blocks on existing pages | One approver after per-page diff review | Page by page |
| 3 | robots.txt, meta robots/noindex, canonical, redirects, hreflang, sitemap, slugs, templates or theme code, site-wide rules | Two approvers; the requester cannot approve | Staging or pull request, one change at a time, in a change window |
| forbidden | Deleting pages, new pages without a named human author, fabricated reviews, ratings or claims, hidden text, cloaking, link schemes, writes outside the approved target, hash or expiry | Never | Never |

## Change lifecycle

`RESOLVE IDS → READ → SNAPSHOT/HASH → DIFF → RISK → APPROVE → CANARY → APPLY → READ-BACK → PUBLIC VALIDATION → CLOSE/ROLLBACK` (04-CLAUDE-CODE-BUILD-PROMPT §15). States are in 03 "Workflow states" and `docs/state-machines.md`.

- Resolve exact tenant, site, repository, branch, page, post, item and field IDs from live connector reads. Never type IDs from memory or guess them from URLs (04 §15; skill `references/cms-changes.md`).
- Bind each approval to target, field, before/after hash, environment, edit or publish mode, approver and expiry (04 §15).
- Detect stale state and conflicts before applying; an expired or mismatched approval stops the change.
- Prefer drafts and pull requests; never push to a default branch or edit a live theme directly (02 §2 "Non-goals").
- Publish is a separate permission. Webflow site publish pushes all staged changes, including other people's, so check staged changes first; editing a published WordPress post changes it live (skill `references/cms-changes.md`).
- Every write uses an idempotency key; a retried write never applies twice (02 §10, §19).
- One change set per site at a time; respect platform rate limits (02 §10).
- Read values back, then fetch the public URL. "Verified" needs a fresh fetch, never the CMS API response alone. Report "live on site" and "seen by Google" separately (02 §10).
- A slug change ships with its 301 redirect and internal-link updates in the same approved change set (04 §15; 01-PRODUCT-REQUIREMENTS §8 "Changes").
- Title or H1 changes need a cannibalization check showing the page owns its main query (02 §8, §10).

## Rollback

Automatic rollback only when the approval explicitly authorizes it, the rollback target matches the stored snapshot, the connector supports reliable reversal, and deterministic read-back detects an exact low- or medium-risk mismatch. Otherwise pause for human review (01 §16 "Adapted rather than copied"). Tier 3 reverts only on a human decision (02 §10).

## Webhooks

Verify each platform's signature and reject replayed event IDs; accept no unsigned events (02 §5, §11).

## Proof required before enabling a connector

Sandbox contract, denial, stale-state, conflict, replay, wrong-tenant, partial-failure, read-back-mismatch, slug/redirect and rollback tests (01 §15 "Production release criteria"; 05-PROJECT-PLAN §5 M9). Failure tests: timeout mid-write, token revoked mid-run, platform rate limit, publish step failing after a write (02 §19).

## Checklist for a change

1. Does any non-connector component gain a write path or credential? Stop.
2. Is every target ID from a live read, and is the approval bound to hash, environment and expiry?
3. Is the tier right, and does Tier 3 enforce two approvers with the requester excluded?
4. Idempotency key, canary, read-back and rollback path all present and tested?
5. Is publishing a separate, explicitly approved step?
6. List concerns in `spec.md`; plans touching connector write paths need a tech lead as well as an engineer.

## Backed by

- Hook: `.claude/hooks/agent_allowlist_guard.py`.
- Config: `config/connectors/*.yaml` (allowed fields, limits, publish rules, webhook secret references).
- Method reference: `.claude/skills/marketing-seo-agent/references/cms-changes.md`.
