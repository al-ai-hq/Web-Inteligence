# Runbook: incident

Status: draft for review
Owner role: Incident commander (incident-response owner)
Sources: 01-PRODUCT-REQUIREMENTS §5.15, §9, §12; 04-CLAUDE-CODE-BUILD-PROMPT §19, §24; 05-PROJECT-PLAN M10, M13; 07-SKILLS-AND-AGENTS §8; docs/threat-model.md; docs/rollback-plan.md §7
Last updated: 2026-09-30

## Trigger

A monitoring alert, a user or client report, a security finding, a cost-guard alarm, or any
suspicion of data exposure or an unauthorized write.

## Severity

ASSUMPTION: levels confirmed at M13.

| Level | Examples |
|---|---|
| SEV1 | Cross-tenant or anonymous-report data exposure; secret or token leak; unauthorized write to a client site; crawler reaching internal addresses; spend past the monthly cap |
| SEV2 | Major outage; wrong scores or numbers shown to users; deletion job failing; data sent to a provider without opt-in; a code path spending outside the provider gateway |
| SEV3 | Degraded optional feature; one provider down (see `docs/runbooks/provider-outage.md`) |

## Steps

1. **Declare.** Open an incident record. Name the incident commander and a scribe. Set severity.
2. **Contain.** Use kill switches (`docs/rollback-plan.md` §7): connector writes off, anonymous
   intake off, paid calls off, gallery off, as needed. Block abusive sources at the edge. Revoke
   exposed credentials first (`docs/runbooks/key-rotation.md`).
3. **Preserve evidence.** Do not delete logs. Copy relevant logs to a restricted incident location;
   keep redaction rules; retention per counsel.
4. **Assess impact.** Which data classes (`docs/data-classification.md`), which audits, projects
   or client sites, which time window. If personal data or tenant data may be affected, bring in
   the privacy owner and counsel now. Counsel decides on notifications and their deadlines.
5. **Communicate.** Internal status at a fixed cadence. External status only with facts, no
   speculation. Client notifications go through the owner and counsel.
6. **Fix and recover.** Fixes go through the normal pipeline with human review, even when urgent.
   Use `docs/runbooks/rollback.md` where a release caused the incident.
7. **Close.** Confirm recovery with evidence. Hold a post-incident review (ASSUMPTION: within 5
   working days). Write a `lessons/` entry and a new intent. Add a test or eval case for the
   failure. Update `docs/threat-model.md` if a boundary or control changed.

## Verification

- The containment action is confirmed in logs or metrics, not assumed.
- Every exposed credential is rotated and the old one revoked.
- A regression test or eval exists before the incident is closed.

## Never

- Speculate in public or blame users.
- Delete or edit evidence and logs.
- Use break-glass access without recording who, when and why.
- Let an agent approve its own hotfix.
- Contact affected users or clients about a SEV1 data incident without counsel.
- Close the incident without a test that would catch it again.
