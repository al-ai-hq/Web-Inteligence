# Runbook: key rotation

Status: draft for review
Owner role: Security owner
Sources: 04-CLAUDE-CODE-BUILD-PROMPT §19, §24; 02-DETAILED-SPECIFICATION §12, §16, §17; v1-baseline §13.3; docs/iam-matrix.md; docs/data-classification.md (C5)
Last updated: 2026-09-30

## Trigger

Scheduled rotation (cadence per key type, `<DECIDE_AT_M0B>`), suspected exposure, a staff or
vendor change, or a provider notice.

## Inventory

| Secret | Held by | Rotation method | Overlap |
|---|---|---|---|
| AI and data-provider API keys | `provider-gateway` (Secret Manager) | Create a new key at the provider; add a new secret version; gateway picks it up; verify; revoke the old key at the provider; disable the old version | Minutes |
| Report access-secret hash key | `web-api` | Add a new key version; store the key ID with every hash; new hashes use the new key; keep the old key until every report hashed with it has expired | Up to 7 days (report lifetime, D-002) |
| Report session and eligibility cookie signing keys | `web-api` | Key ID in each cookie; sign with the new key; accept both during overlap; retire the old key | Cookie lifetime, or accept a reset |
| Domain-hash key for logs | `web-api`, services | New key version; correlation breaks across the boundary, so rotate on schedule only | None needed |
| Platform OAuth client secrets (CMS, Search Console) | `connector`, `source-reader` | Rotate at the platform; add a new secret version; verify callback | Per platform |
| Tenant OAuth tokens and CMS credentials | `connector`, `source-reader` | Tenant-owned. On suspected exposure, revoke at the platform and ask the tenant to reconnect | None |
| Webhook secrets (M9) | `webhook-receiver` | Per connection, with overlap where the platform supports two secrets | Per platform |
| Cloud KMS keys (CMEK) | KMS | Scheduled rotation (ASSUMPTION: enabled); old key versions stay enabled for decryption until data under them is re-encrypted or expired | Automatic |
| CI access | Workload Identity Federation | No keys to rotate; review trust conditions on schedule | n/a |

## Steps

1. Prepare the new secret or key version.
2. Deploy it and run both old and new during the overlap window where one exists.
3. Verify: calls succeed with the new version; error rates flat.
4. Revoke or disable the old version, at the provider and in Secret Manager.
5. Record who, when, which secret and the verification result in the audit log.

On suspected compromise, reverse the order: revoke first, then restore service with a new secret,
and open an incident (`docs/runbooks/incident.md`).

## Verification

- The old version is disabled or destroyed, and the provider shows it revoked.
- No service logs authentication failures after the overlap.

## Never

- Paste a secret into chat, tickets, pull requests, logs, Claude Code sessions or source control.
- Create service-account keys (org policy).
- Send keys by email or messaging.
- Change production secrets outside Secret Manager and the reviewed process.
