# Runbook: deletion request

Status: draft for review
Owner role: Privacy owner
Sources: 01-PRODUCT-REQUIREMENTS §5.0, §9, §12; 03-PRODUCTION-CONTRACTS (`DeletionReceipt`); 04-CLAUDE-CODE-BUILD-PROMPT §19; v1-baseline §9.6, §10, §13.3; docs/retention-deletion-map.md; docs/decisions.md D-002, D-004
Last updated: 2026-09-30

## Trigger

- A visitor presses delete on an anonymous report (automatic, mechanism DM-2).
- A registered user deletes an audit, a project or the account, or disconnects a connection (automatic).
- A privacy request arrives through the published contact channel: access, correction, deletion,
  restriction or export (v1-baseline §9.6). This runbook covers the manual path.

## Steps (manual path)

1. Log the request with its received date. Collect no more personal data than you need.
2. Verify authority:
   - registered user: signed-in session or a verified match with the account email;
   - anonymous report: possession of the report link. We hold no identity for anonymous visitors,
     so we cannot find their audits any other way;
   - a site owner asking to remove audits of their site requested by others: anonymous audits are
     private and expire within 7 days; whether to delete them on the owner's request is a counsel
     decision (`<DECIDE_AT_M0: counsel>`).
3. Identify subjects (account, projects, audits, connections) and every store listed in
   `docs/retention-deletion-map.md` §3 to §5.
4. Run the deletion workflow (the same code as DM-1 and DM-2). Revoke tokens at the platforms.
   Delete the identity-provider user for account deletion.
5. Provider-side copies: where a provider offers deletion or retention controls, use them;
   otherwise record the residual copy and its stated retention from `config/providers.yaml`.
6. Backups: record the expiry date. The deletion queue re-applies on any restore.
7. Generate the `DeletionReceipt`. Confirm post-deletion lookups return nothing in each store.
8. Reply within `<DECIDE_AT_M0: legal response deadline, set by counsel>`: what was deleted, what
   remains and until when (backups, provider copies, audit-log entries about the request itself).
9. Legal hold or other exceptions: only on counsel's written instruction.

## Verification

- The receipt lists every store checked, counts deleted and residual copies with dates.
- The nightly integrity job shows no records for the subject.
- If a gap was found, a TS-DELETE regression case is added.

## Never

- Put deleted content, URLs or extra personal data in the receipt or the ticket.
- Ask for identity documents beyond what verification needs.
- Delete audit-log entries, including the entry recording this deletion.
- Say deletion is complete without naming residual copies and their expiry.
- Act on a request whose authority was not verified.
