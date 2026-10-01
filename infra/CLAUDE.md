# infra

Terraform modules for dev, staging, and prod. No resources at M0A (05 §9).

## Rules

- No hardcoded project IDs, regions, or credentials.
- Every resource must have tags: `environment`, `managed-by`, `cost-center`.
- State is remote (GCS bucket); never commit `.tfstate` files.
- Prod changes require a separate plan review and human approval.
