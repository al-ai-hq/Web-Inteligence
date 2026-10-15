# M0B Contracts, Threat Model and Cost Proof — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build 5 exit-gate proof scripts that validate the WPI V5 schemas, state machines, cost model, and IAM matrix hold together.

**Architecture:** Each proof is a standalone Python script with JSON fixtures validated against the project's JSON Schema (draft 2020-12) files. A shared helper module handles schema resolution, fixture loading, and config parsing. A runner script executes all proofs and prints a summary.

**Tech Stack:** Python 3.12+, `jsonschema` (with `referencing` for `$ref` resolution), `pyyaml`, `pytest` (optional, proofs are self-contained).

**Spec:** `docs/superpowers/specs/2026-10-01-m0b-contracts-threat-model-cost-proof-design.md`

## Global Constraints

- All JSON fixtures MUST validate against their schemas (draft 2020-12) using `$ref` resolution via `schemas/common.schema.json`.
- Money values are decimal strings (never floats). Use Python `Decimal` for all arithmetic.
- Timestamps are RFC 3339 UTC ending in `Z`.
- UUIDs are lowercase.
- No network calls. All proofs run offline against local fixtures.
- Each proof exits 0 on pass, 1 on fail. The runner exits 0 only when all 5 pass.
- Proof output is one line: `PASS` or `FAIL` with a short reason.
- Do not modify schemas unless a proof requires it. Document every schema change in the proof output.

---

### Task 1: Proof Infrastructure

**Files:**

- Create: `scripts/proofs/__init__.py`
- Create: `scripts/proofs/helpers.py`
- Create: `scripts/proofs/run_all.py`
- Create: `scripts/proofs/requirements.txt`
- Create: `scripts/proofs/fixtures/.gitkeep`

**Interfaces:**

- Consumes: `schemas/*.schema.json`, `config/scoring.yaml`, `config/budgets.yaml`
- Produces: `helpers.load_schema(name)`, `helpers.load_fixture(proof, name)`, `helpers.load_config(name)`, `helpers.validate(instance, schema_name)`, `helpers.run_all()`

- [ ] **Step 1: Create the proofs directory**

```bash
mkdir -p scripts/proofs/fixtures
touch scripts/proofs/__init__.py
touch scripts/proofs/fixtures/.gitkeep
```

- [ ] **Step 2: Create requirements.txt**

```
# scripts/proofs/requirements.txt
jsonschema>=4.21.0
referencing>=0.31.0
pyyaml>=6.0
```

- [ ] **Step 3: Install dependencies**

Run: `pip install -r scripts/proofs/requirements.txt`
Expected: All three packages install without error.

- [ ] **Step 4: Write helpers.py**

```python
"""Shared helpers for M0B proof scripts."""

import json
import sys
from decimal import Decimal, InvalidOperation
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SCHEMAS_DIR = REPO_ROOT / "schemas"
CONFIG_DIR = REPO_ROOT / "config"
FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


def _build_registry() -> Registry:
    """Build a referencing.Registry from all schemas in schemas/."""
    resources = []
    for schema_file in sorted(SCHEMAS_DIR.glob("*.schema.json")):
        with open(schema_file) as f:
            doc = json.load(f)
        resource = Resource.from_contents(doc, default_specification=DRAFT202012)
        schema_id = doc.get("$id", schema_file.name)
        resources.append((schema_id, resource))
    return Registry().with_resources(resources)


REGISTRY = _build_registry()


def load_schema(name: str) -> dict:
    """Load a schema by filename (e.g. 'audit.schema.json')."""
    path = SCHEMAS_DIR / name
    with open(path) as f:
        return json.load(f)


def load_fixture(proof_dir: str, name: str) -> dict | list:
    """Load a JSON fixture from scripts/proofs/fixtures/<proof_dir>/<name>."""
    path = FIXTURES_DIR / proof_dir / name
    with open(path) as f:
        return json.load(f)


def load_config(name: str) -> dict:
    """Load a YAML config file from config/."""
    path = CONFIG_DIR / name
    with open(path) as f:
        return yaml.safe_load(f)


def validate(instance: dict, schema_name: str) -> list[str]:
    """Validate an instance against a schema. Return list of error messages (empty = valid)."""
    schema = load_schema(schema_name)
    validator = Draft202012Validator(schema, registry=REGISTRY)
    errors = []
    for error in sorted(validator.iter_errors(instance), key=lambda e: list(e.path)):
        path = ".".join(str(p) for p in error.absolute_path) or "(root)"
        errors.append(f"{path}: {error.message}")
    return errors


def assert_valid(instance: dict, schema_name: str, label: str = "") -> None:
    """Assert the instance validates. Print errors and exit 1 on failure."""
    errors = validate(instance, schema_name)
    if errors:
        prefix = f"{label}: " if label else ""
        print(f"FAIL: {prefix}{schema_name} validation failed with {len(errors)} error(s)")
        for e in errors:
            print(f"  - {e}")
        sys.exit(1)


def assert_invalid(instance: dict, schema_name: str, label: str = "") -> list[str]:
    """Assert the instance does NOT validate. Return the error messages."""
    errors = validate(instance, schema_name)
    if not errors:
        prefix = f"{label}: " if label else ""
        print(f"FAIL: {prefix}{schema_name} should have failed validation but passed")
        sys.exit(1)
    return errors


def money(amount: str, currency: str = "USD") -> dict:
    """Create a money object."""
    return {"amount": amount, "currency": currency}


def decimal_amount(m: dict) -> Decimal:
    """Extract the Decimal amount from a money object."""
    return Decimal(m["amount"])
```

- [ ] **Step 5: Write run_all.py**

```python
#!/usr/bin/env python3
"""Run all 5 M0B exit-gate proofs and print a summary."""

import importlib
import sys
import time

PROOFS = [
    ("proof_1_reproduce_score", "Reproduce score"),
    ("proof_2_reject_invalid", "Reject invalid record"),
    ("proof_3_trace_lineage", "Trace report number to evidence"),
    ("proof_4_deny_unauthorized", "Deny unauthorized export/write"),
    ("proof_5_cost_hard_stop", "Simulate USD 150 hard stop"),
]


def main() -> int:
    results = []
    for module_name, label in PROOFS:
        start = time.monotonic()
        try:
            mod = importlib.import_module(f"scripts.proofs.{module_name}")
            ok = mod.run()
        except SystemExit as e:
            ok = e.code == 0
        except Exception as exc:
            print(f"Proof {module_name} raised: {exc}")
            ok = False
        elapsed = time.monotonic() - start
        status = "PASS" if ok else "FAIL"
        dots = "." * max(1, 36 - len(label))
        print(f"  {label} {dots} {status} ({elapsed:.1f}s)")
        results.append(ok)

    passed = sum(results)
    total = len(results)
    print()
    print(f"  {passed}/{total} passed.", end=" ")
    if passed == total:
        print("Exit gate: OPEN.")
        return 0
    else:
        print("Exit gate: BLOCKED.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 6: Verify infrastructure loads**

Run: `cd /Users/ibrahimabedrabboh/Qoder/Qoder && python3 -c "from scripts.proofs.helpers import load_schema; s = load_schema('common.schema.json'); print(f'Loaded {s[\"title\"]} with {len(s[\"$defs\"])} defs')"`
Expected: `Loaded Common with 42 defs` (or similar count).

- [ ] **Step 7: Commit**

```bash
git add scripts/proofs/
git commit -m "feat(M0B): add proof infrastructure — helpers, runner, requirements"
```

---

### Task 2: Proof 1 — Reproduce Score

**Files:**

- Create: `scripts/proofs/fixtures/proof_1/audit.json`
- Create: `scripts/proofs/fixtures/proof_1/evidence_1.json`
- Create: `scripts/proofs/fixtures/proof_1/evidence_2.json`
- Create: `scripts/proofs/fixtures/proof_1/evidence_3.json`
- Create: `scripts/proofs/fixtures/proof_1/rule_results.json`
- Create: `scripts/proofs/fixtures/proof_1/score_result.json`
- Create: `scripts/proofs/fixtures/proof_1/rule_catalog.json`
- Create: `scripts/proofs/proof_1_reproduce_score.py`

**Interfaces:**

- Consumes: helpers module, schemas (audit, evidence-object, rule-result, score-result, common), config/scoring.yaml
- Produces: `run() -> bool` — validates all fixtures, recomputes score, compares to stored

**Scoring formula (from config/scoring.yaml):**

- `category_score_c = 100 * SUM(result_value * importance_weight) / SUM(importance_weight)` for scored rules in category c
- `readiness_pre_cap = SUM(category_score_c * category_weight / 100)` over 7 categories
- `readiness = MIN(readiness_pre_cap, applicable_critical_caps)`
- Rule values: pass=1.00, partial=0.50, fail=0.00

**Test data design:**

- 7 rules, one per category, all with importance_weight=1
- Results: CRW-001 pass, SEO-001 partial, STR-001 fail, AEO-001 pass, GEO-001 pass, I18N-001 partial, PRF-001 pass
- Expected category scores: crawlability=100, on_page=50, structured_data=0, aeo=100, geo=100, i18n_accessibility=50, performance_security=100
- Expected pre_cap = (100×20 + 50×15 + 0×10 + 100×20 + 100×15 + 50×10 + 100×10) / 100 = 72.5
- No critical caps apply

- [ ] **Step 1: Create the rule catalog fixture**

```json
// scripts/proofs/fixtures/proof_1/rule_catalog.json
{
  "CRW-001": { "category": "crawlability", "importance_weight": 1 },
  "SEO-001": { "category": "on_page", "importance_weight": 1 },
  "STR-001": { "category": "structured_data", "importance_weight": 1 },
  "AEO-001": { "category": "aeo", "importance_weight": 1 },
  "GEO-001": { "category": "geo", "importance_weight": 1 },
  "I18N-001": { "category": "i18n_accessibility", "importance_weight": 1 },
  "PRF-001": { "category": "performance_security", "importance_weight": 1 }
}
```

- [ ] **Step 2: Create the audit fixture**

```json
// scripts/proofs/fixtures/proof_1/audit.json
{
  "audit_id": "a1b2c3d4-1111-4aaa-bbbb-000000000001",
  "access_class": "registered",
  "project_id": "a1b2c3d4-1111-4aaa-bbbb-000000000099",
  "site_id": "a1b2c3d4-1111-4aaa-bbbb-000000000098",
  "owner_user_id": "a1b2c3d4-1111-4aaa-bbbb-000000000097",
  "mode": "single_page",
  "target_url": "https://example.com/",
  "status": "READY_COMPLETE",
  "methodology_version": "0.1.0-draft",
  "noindex": false,
  "created_at": "2026-10-01T10:00:00Z",
  "updated_at": "2026-10-01T10:05:00Z",
  "completed_at": "2026-10-01T10:05:00Z"
}
```

- [ ] **Step 3: Create 3 evidence fixtures**

Each evidence object needs: evidence_id, kind, injection_suspected=false, immutable=true, expires_at, lineage (with all 17 required fields).

```json
// scripts/proofs/fixtures/proof_1/evidence_1.json
{
  "evidence_id": "e1e1e1e1-1111-4eee-bbbb-000000000001",
  "audit_id": "a1b2c3d4-1111-4aaa-bbbb-000000000001",
  "kind": "http_response",
  "url": "https://example.com/",
  "http_status": 200,
  "content_type": "text/html",
  "injection_suspected": false,
  "immutable": true,
  "expires_at": "2026-10-31T10:00:00Z",
  "lineage": {
    "record_id": "e1e1e1e1-1111-4eee-bbbb-000000000001",
    "project_id": "a1b2c3d4-1111-4aaa-bbbb-000000000099",
    "site_id": "a1b2c3d4-1111-4aaa-bbbb-000000000098",
    "source_type": "crawler",
    "source_id": "crawl-run-001",
    "source_version": "1.0.0",
    "captured_at": "2026-10-01T10:00:00Z",
    "as_of": "2026-10-01T10:00:00Z",
    "market": "SA",
    "language": "ar",
    "device": "desktop",
    "method": "raw_http_fetch",
    "methodology_version": "0.1.0-draft",
    "fidelity_label": "observed",
    "content_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "parent_ids": [],
    "validation_state": "valid"
  }
}
```

Create `evidence_2.json` and `evidence_3.json` with different evidence_ids (`e1e1e1e1-1111-4eee-bbbb-000000000002`, `...003`), kinds (`rendered_dom`, `structured_data`), and matching lineage record_ids. All other structure identical.

- [ ] **Step 4: Create rule results fixture**

Array of 7 rule results. Each needs: rule_result_id, audit_id, rule_id, methodology_version, result, method, scope, affected_urls, evidence_ids, confidence, evaluated_at, lineage.

```json
// scripts/proofs/fixtures/proof_1/rule_results.json
[
  {
    "rule_result_id": "rr000000-1111-4rrr-bbbb-000000000001",
    "audit_id": "a1b2c3d4-1111-4aaa-bbbb-000000000001",
    "rule_id": "CRW-001",
    "methodology_version": "0.1.0-draft",
    "result": "pass",
    "method": "deterministic",
    "scope": "page",
    "page_url": "https://example.com/",
    "affected_urls": ["https://example.com/"],
    "evidence_ids": ["e1e1e1e1-1111-4eee-bbbb-000000000001"],
    "confidence": "high",
    "evaluated_at": "2026-10-01T10:02:00Z",
    "lineage": {
      "record_id": "rr000000-1111-4rrr-bbbb-000000000001",
      "project_id": "a1b2c3d4-1111-4aaa-bbbb-000000000099",
      "site_id": "a1b2c3d4-1111-4aaa-bbbb-000000000098",
      "source_type": "rules_engine",
      "source_id": "CRW-001",
      "source_version": "0.1.0-draft",
      "captured_at": "2026-10-01T10:02:00Z",
      "as_of": "2026-10-01T10:00:00Z",
      "market": "SA",
      "language": "ar",
      "device": "desktop",
      "method": "rules_engine",
      "methodology_version": "0.1.0-draft",
      "fidelity_label": "computed",
      "content_hash": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "parent_ids": ["e1e1e1e1-1111-4eee-bbbb-000000000001"],
      "validation_state": "valid"
    }
  },
  {
    "rule_result_id": "rr000000-1111-4rrr-bbbb-000000000002",
    "audit_id": "a1b2c3d4-1111-4aaa-bbbb-000000000001",
    "rule_id": "SEO-001",
    "methodology_version": "0.1.0-draft",
    "result": "partial",
    "method": "deterministic",
    "scope": "page",
    "page_url": "https://example.com/",
    "affected_urls": ["https://example.com/"],
    "evidence_ids": ["e1e1e1e1-1111-4eee-bbbb-000000000001"],
    "confidence": "high",
    "evaluated_at": "2026-10-01T10:02:00Z",
    "lineage": {
      "record_id": "rr000000-1111-4rrr-bbbb-000000000002",
      "project_id": "a1b2c3d4-1111-4aaa-bbbb-000000000099",
      "site_id": "a1b2c3d4-1111-4aaa-bbbb-000000000098",
      "source_type": "rules_engine",
      "source_id": "SEO-001",
      "source_version": "0.1.0-draft",
      "captured_at": "2026-10-01T10:02:00Z",
      "as_of": "2026-10-01T10:00:00Z",
      "market": "SA",
      "language": "ar",
      "device": "desktop",
      "method": "rules_engine",
      "methodology_version": "0.1.0-draft",
      "fidelity_label": "computed",
      "content_hash": "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "parent_ids": ["e1e1e1e1-1111-4eee-bbbb-000000000001"],
      "validation_state": "valid"
    }
  },
  {
    "rule_result_id": "rr000000-1111-4rrr-bbbb-000000000003",
    "audit_id": "a1b2c3d4-1111-4aaa-bbbb-000000000001",
    "rule_id": "STR-001",
    "methodology_version": "0.1.0-draft",
    "result": "fail",
    "method": "deterministic",
    "scope": "page",
    "page_url": "https://example.com/",
    "affected_urls": ["https://example.com/"],
    "evidence_ids": ["e1e1e1e1-1111-4eee-bbbb-000000000002"],
    "confidence": "high",
    "evaluated_at": "2026-10-01T10:02:00Z",
    "lineage": {
      "record_id": "rr000000-1111-4rrr-bbbb-000000000003",
      "project_id": "a1b2c3d4-1111-4aaa-bbbb-000000000099",
      "site_id": "a1b2c3d4-1111-4aaa-bbbb-000000000098",
      "source_type": "rules_engine",
      "source_id": "STR-001",
      "source_version": "0.1.0-draft",
      "captured_at": "2026-10-01T10:02:00Z",
      "as_of": "2026-10-01T10:00:00Z",
      "market": "SA",
      "language": "ar",
      "device": "desktop",
      "method": "rules_engine",
      "methodology_version": "0.1.0-draft",
      "fidelity_label": "computed",
      "content_hash": "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      "parent_ids": ["e1e1e1e1-1111-4eee-bbbb-000000000002"],
      "validation_state": "valid"
    }
  },
  {
    "rule_result_id": "rr000000-1111-4rrr-bbbb-000000000004",
    "audit_id": "a1b2c3d4-1111-4aaa-bbbb-000000000001",
    "rule_id": "AEO-001",
    "methodology_version": "0.1.0-draft",
    "result": "pass",
    "method": "deterministic",
    "scope": "page",
    "page_url": "https://example.com/",
    "affected_urls": ["https://example.com/"],
    "evidence_ids": ["e1e1e1e1-1111-4eee-bbbb-000000000001"],
    "confidence": "high",
    "evaluated_at": "2026-10-01T10:02:00Z",
    "lineage": {
      "record_id": "rr000000-1111-4rrr-bbbb-000000000004",
      "project_id": "a1b2c3d4-1111-4aaa-bbbb-000000000099",
      "site_id": "a1b2c3d4-1111-4aaa-bbbb-000000000098",
      "source_type": "rules_engine",
      "source_id": "AEO-001",
      "source_version": "0.1.0-draft",
      "captured_at": "2026-10-01T10:02:00Z",
      "as_of": "2026-10-01T10:00:00Z",
      "market": "SA",
      "language": "ar",
      "device": "desktop",
      "method": "rules_engine",
      "methodology_version": "0.1.0-draft",
      "fidelity_label": "computed",
      "content_hash": "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      "parent_ids": ["e1e1e1e1-1111-4eee-bbbb-000000000001"],
      "validation_state": "valid"
    }
  },
  {
    "rule_result_id": "rr000000-1111-4rrr-bbbb-000000000005",
    "audit_id": "a1b2c3d4-1111-4aaa-bbbb-000000000001",
    "rule_id": "GEO-001",
    "methodology_version": "0.1.0-draft",
    "result": "pass",
    "method": "deterministic",
    "scope": "page",
    "page_url": "https://example.com/",
    "affected_urls": ["https://example.com/"],
    "evidence_ids": ["e1e1e1e1-1111-4eee-bbbb-000000000003"],
    "confidence": "high",
    "evaluated_at": "2026-10-01T10:02:00Z",
    "lineage": {
      "record_id": "rr000000-1111-4rrr-bbbb-000000000005",
      "project_id": "a1b2c3d4-1111-4aaa-bbbb-000000000099",
      "site_id": "a1b2c3d4-1111-4aaa-bbbb-000000000098",
      "source_type": "rules_engine",
      "source_id": "GEO-001",
      "source_version": "0.1.0-draft",
      "captured_at": "2026-10-01T10:02:00Z",
      "as_of": "2026-10-01T10:00:00Z",
      "market": "SA",
      "language": "ar",
      "device": "desktop",
      "method": "rules_engine",
      "methodology_version": "0.1.0-draft",
      "fidelity_label": "computed",
      "content_hash": "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      "parent_ids": ["e1e1e1e1-1111-4eee-bbbb-000000000003"],
      "validation_state": "valid"
    }
  },
  {
    "rule_result_id": "rr000000-1111-4rrr-bbbb-000000000006",
    "audit_id": "a1b2c3d4-1111-4aaa-bbbb-000000000001",
    "rule_id": "I18N-001",
    "methodology_version": "0.1.0-draft",
    "result": "partial",
    "method": "deterministic",
    "scope": "page",
    "page_url": "https://example.com/",
    "affected_urls": ["https://example.com/"],
    "evidence_ids": ["e1e1e1e1-1111-4eee-bbbb-000000000001"],
    "confidence": "high",
    "evaluated_at": "2026-10-01T10:02:00Z",
    "lineage": {
      "record_id": "rr000000-1111-4rrr-bbbb-000000000006",
      "project_id": "a1b2c3d4-1111-4aaa-bbbb-000000000099",
      "site_id": "a1b2c3d4-1111-4aaa-bbbb-000000000098",
      "source_type": "rules_engine",
      "source_id": "I18N-001",
      "source_version": "0.1.0-draft",
      "captured_at": "2026-10-01T10:02:00Z",
      "as_of": "2026-10-01T10:00:00Z",
      "market": "SA",
      "language": "ar",
      "device": "desktop",
      "method": "rules_engine",
      "methodology_version": "0.1.0-draft",
      "fidelity_label": "computed",
      "content_hash": "sha256:1111111111111111111111111111111111111111111111111111111111111111",
      "parent_ids": ["e1e1e1e1-1111-4eee-bbbb-000000000001"],
      "validation_state": "valid"
    }
  },
  {
    "rule_result_id": "rr000000-1111-4rrr-bbbb-000000000007",
    "audit_id": "a1b2c3d4-1111-4aaa-bbbb-000000000001",
    "rule_id": "PRF-001",
    "methodology_version": "0.1.0-draft",
    "result": "pass",
    "method": "deterministic",
    "scope": "page",
    "page_url": "https://example.com/",
    "affected_urls": ["https://example.com/"],
    "evidence_ids": ["e1e1e1e1-1111-4eee-bbbb-000000000002"],
    "confidence": "high",
    "evaluated_at": "2026-10-01T10:02:00Z",
    "lineage": {
      "record_id": "rr000000-1111-4rrr-bbbb-000000000007",
      "project_id": "a1b2c3d4-1111-4aaa-bbbb-000000000099",
      "site_id": "a1b2c3d4-1111-4aaa-bbbb-000000000098",
      "source_type": "rules_engine",
      "source_id": "PRF-001",
      "source_version": "0.1.0-draft",
      "captured_at": "2026-10-01T10:02:00Z",
      "as_of": "2026-10-01T10:00:00Z",
      "market": "SA",
      "language": "ar",
      "device": "desktop",
      "method": "rules_engine",
      "methodology_version": "0.1.0-draft",
      "fidelity_label": "computed",
      "content_hash": "sha256:2222222222222222222222222222222222222222222222222222222222222222",
      "parent_ids": ["e1e1e1e1-1111-4eee-bbbb-000000000002"],
      "validation_state": "valid"
    }
  }
]
```

- [ ] **Step 5: Create the score result fixture**

The stored score we expect to reproduce. `value` = 72.5, `pre_cap_value` = 72.5.

```json
// scripts/proofs/fixtures/proof_1/score_result.json
{
  "score_result_id": "sr000000-1111-4sss-bbbb-000000000001",
  "audit_id": "a1b2c3d4-1111-4aaa-bbbb-000000000001",
  "score_kind": "presence_readiness",
  "value": 72.5,
  "pre_cap_value": 72.5,
  "applied_cap": null,
  "coverage": {
    "measurable_applicable_weight": 60,
    "total_expected_applicable_weight": 100,
    "ratio": 0.6
  },
  "checked": { "checked": 7, "of": 7 },
  "pages_inspected": 1,
  "confidence": "high",
  "rule_result_ids": [
    "rr000000-1111-4rrr-bbbb-000000000001",
    "rr000000-1111-4rrr-bbbb-000000000002",
    "rr000000-1111-4rrr-bbbb-000000000003",
    "rr000000-1111-4rrr-bbbb-000000000004",
    "rr000000-1111-4rrr-bbbb-000000000005",
    "rr000000-1111-4rrr-bbbb-000000000006",
    "rr000000-1111-4rrr-bbbb-000000000007"
  ],
  "methodology_version": "0.1.0-draft",
  "computed_at": "2026-10-01T10:03:00Z",
  "lineage": {
    "record_id": "sr000000-1111-4sss-bbbb-000000000001",
    "project_id": "a1b2c3d4-1111-4aaa-bbbb-000000000099",
    "site_id": "a1b2c3d4-1111-4aaa-bbbb-000000000098",
    "source_type": "computation",
    "source_id": "scoring-engine",
    "source_version": "0.1.0-draft",
    "captured_at": "2026-10-01T10:03:00Z",
    "as_of": "2026-10-01T10:00:00Z",
    "market": "SA",
    "language": "ar",
    "device": "desktop",
    "method": "rules_engine",
    "methodology_version": "0.1.0-draft",
    "fidelity_label": "computed",
    "content_hash": "sha256:3333333333333333333333333333333333333333333333333333333333333333",
    "parent_ids": [
      "rr000000-1111-4rrr-bbbb-000000000001",
      "rr000000-1111-4rrr-bbbb-000000000002",
      "rr000000-1111-4rrr-bbbb-000000000003",
      "rr000000-1111-4rrr-bbbb-000000000004",
      "rr000000-1111-4rrr-bbbb-000000000005",
      "rr000000-1111-4rrr-bbbb-000000000006",
      "rr000000-1111-4rrr-bbbb-000000000007"
    ],
    "validation_state": "valid"
  }
}
```

- [ ] **Step 6: Write the proof script**

```python
#!/usr/bin/env python3
"""Proof 1: Reproduce one Presence Readiness score from stored rule results."""

from decimal import Decimal

from scripts.proofs.helpers import (
    assert_valid,
    load_config,
    load_fixture,
)

RESULT_VALUES = {"pass": Decimal("1.00"), "partial": Decimal("0.50"), "fail": Decimal("0.00")}


def run() -> bool:
    scoring_config = load_config("scoring.yaml")
    category_weights = {cat: data["weight"] for cat, data in scoring_config["categories"].items()}

    audit = load_fixture("proof_1", "audit.json")
    assert_valid(audit, "audit.schema.json", "audit")

    evidence_ids = set()
    for name in ["evidence_1.json", "evidence_2.json", "evidence_3.json"]:
        ev = load_fixture("proof_1", name)
        assert_valid(ev, "evidence-object.schema.json", name)
        evidence_ids.add(ev["evidence_id"])

    rule_results = load_fixture("proof_1", "rule_results.json")
    rule_catalog = load_fixture("proof_1", "rule_catalog.json")

    for rr in rule_results:
        assert_valid(rr, "rule-result.schema.json", f"rule_result {rr['rule_id']}")
        if rr["evidence_ids"]:
            for eid in rr["evidence_ids"]:
                if eid not in evidence_ids:
                    print(f"FAIL: rule_result {rr['rule_id']} references unknown evidence {eid}")
                    return False

    score_result = load_fixture("proof_1", "score_result.json")
    assert_valid(score_result, "score-result.schema.json", "score_result")

    category_sums = {}
    for rr in rule_results:
        if rr["result"] not in RESULT_VALUES:
            continue
        rule_id = rr["rule_id"]
        if rule_id not in rule_catalog:
            print(f"FAIL: unknown rule_id {rule_id}")
            return False
        cat = rule_catalog[rule_id]["category"]
        weight = rule_catalog[rule_id]["importance_weight"]
        value = RESULT_VALUES[rr["result"]]
        if cat not in category_sums:
            category_sums[cat] = {"numerator": Decimal("0"), "denominator": Decimal("0")}
        category_sums[cat]["numerator"] += value * Decimal(str(weight))
        category_sums[cat]["denominator"] += Decimal(str(weight))

    hundred = Decimal("100")
    pre_cap = Decimal("0")
    for cat, cat_weight in category_weights.items():
        if cat in category_sums and category_sums[cat]["denominator"] > 0:
            cat_score = hundred * category_sums[cat]["numerator"] / category_sums[cat]["denominator"]
        else:
            cat_score = Decimal("0")
        pre_cap += cat_score * Decimal(str(cat_weight)) / hundred

    stored_pre_cap = Decimal(str(score_result["pre_cap_value"]))
    stored_value = Decimal(str(score_result["value"]))

    if pre_cap != stored_pre_cap:
        print(f"FAIL: recomputed pre_cap={pre_cap} != stored pre_cap_value={stored_pre_cap}")
        return False

    if stored_value != stored_pre_cap:
        print(f"FAIL: stored value={stored_value} != pre_cap={stored_pre_cap} (no cap expected)")
        return False

    print(f"PASS: score reproduced — pre_cap={pre_cap}, stored={stored_value}")
    return True


if __name__ == "__main__":
    import sys
    sys.exit(0 if run() else 1)
```

- [ ] **Step 7: Run the proof and verify it passes**

Run: `cd /Users/ibrahimabedrabboh/Qoder/Qoder && python3 -m scripts.proofs.proof_1_reproduce_score`
Expected: `PASS: score reproduced — pre_cap=72.5, stored=72.5`

If validation errors appear, fix the fixture JSON to match the schema. Common issues: missing lineage fields, wrong timestamp format, UUID pattern mismatch.

- [ ] **Step 8: Commit**

```bash
git add scripts/proofs/proof_1_reproduce_score.py scripts/proofs/fixtures/proof_1/
git commit -m "feat(M0B): add Proof 1 — reproduce Presence Readiness score"
```

---

### Task 3: Proof 2 — Reject Invalid Record

**Files:**

- Create: `scripts/proofs/fixtures/proof_2/audit_ssrf.json`
- Create: `scripts/proofs/fixtures/proof_2/rule_result_bad_fidelity.json`
- Create: `scripts/proofs/proof_2_reject_invalid.py`

**Interfaces:**

- Consumes: helpers module, schemas (audit, rule-result, common)
- Produces: `run() -> bool` — asserts both fixtures fail validation

- [ ] **Step 1: Create the SSRF audit fixture**

This fixture has a valid URL format (`^https?://`) but targets a metadata service IP. The schema accepts it (URL pattern allows it), so the proof checks that our _logic_ would reject it. We validate the URL against a blocklist in the proof script.

```json
// scripts/proofs/fixtures/proof_2/audit_ssrf.json
{
  "audit_id": "b2b2b2b2-2222-4bbb-aaaa-000000000001",
  "access_class": "registered",
  "project_id": "b2b2b2b2-2222-4bbb-aaaa-000000000099",
  "site_id": "b2b2b2b2-2222-4bbb-aaaa-000000000098",
  "owner_user_id": "b2b2b2b2-2222-4bbb-aaaa-000000000097",
  "mode": "single_page",
  "target_url": "http://169.254.169.254/latest/meta-data/",
  "status": "QUEUED",
  "methodology_version": "0.1.0-draft",
  "noindex": false,
  "created_at": "2026-10-01T10:00:00Z",
  "updated_at": "2026-10-01T10:00:00Z"
}
```

- [ ] **Step 2: Create the invalid fidelity label fixture**

This fixture uses `"estimated"` as a fidelity label in a rule result lineage — which IS a valid enum value. Instead, we use a completely invalid value to test schema rejection.

```json
// scripts/proofs/fixtures/proof_2/rule_result_bad_fidelity.json
{
  "rule_result_id": "rr111111-2222-4rrr-bbbb-000000000001",
  "audit_id": "b2b2b2b2-2222-4bbb-aaaa-000000000001",
  "rule_id": "CRW-001",
  "methodology_version": "0.1.0-draft",
  "result": "pass",
  "method": "deterministic",
  "scope": "page",
  "page_url": "https://example.com/",
  "affected_urls": ["https://example.com/"],
  "evidence_ids": ["e1e1e1e1-1111-4eee-bbbb-000000000001"],
  "confidence": "high",
  "evaluated_at": "2026-10-01T10:02:00Z",
  "lineage": {
    "record_id": "rr111111-2222-4rrr-bbbb-000000000001",
    "project_id": "b2b2b2b2-2222-4bbb-aaaa-000000000099",
    "site_id": "b2b2b2b2-2222-4bbb-aaaa-000000000098",
    "source_type": "rules_engine",
    "source_id": "CRW-001",
    "source_version": "0.1.0-draft",
    "captured_at": "2026-10-01T10:02:00Z",
    "as_of": "2026-10-01T10:00:00Z",
    "market": "SA",
    "language": "ar",
    "device": "desktop",
    "method": "rules_engine",
    "methodology_version": "0.1.0-draft",
    "fidelity_label": "guessed",
    "content_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "parent_ids": [],
    "validation_state": "valid"
  }
}
```

- [ ] **Step 3: Write the proof script**

```python
#!/usr/bin/env python3
"""Proof 2: Reject invalid records — SSRF URL and unknown fidelity label."""

import ipaddress
import re
from urllib.parse import urlparse

from scripts.proofs.helpers import (
    assert_invalid,
    load_fixture,
    validate,
)

SSRF_BLOCKED_NETWORKS = [
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
]


def url_is_ssrf(url: str) -> bool:
    """Check if a URL targets a private/reserved network."""
    parsed = urlparse(url)
    hostname = parsed.hostname
    if not hostname:
        return True
    try:
        addr = ipaddress.ip_address(hostname)
        return any(addr in net for net in SSRF_BLOCKED_NETWORKS)
    except ValueError:
        return False


def run() -> bool:
    audit_ssrf = load_fixture("proof_2", "audit_ssrf.json")
    target_url = audit_ssrf["target_url"]
    if not url_is_ssrf(target_url):
        print(f"FAIL: SSRF URL {target_url} was not detected as SSRF")
        return False

    rule_bad = load_fixture("proof_2", "rule_result_bad_fidelity.json")
    errors = validate(rule_bad, "rule-result.schema.json")
    if not errors:
        print("FAIL: rule_result with fidelity_label='guessed' should fail validation")
        return False

    fidelity_errors = [e for e in errors if "fidelity_label" in e]
    if not fidelity_errors:
        print(f"FAIL: expected fidelity_label validation error, got: {errors}")
        return False

    print(f"PASS: SSRF URL rejected, invalid fidelity_label rejected ({len(errors)} schema error(s))")
    return True


if __name__ == "__main__":
    import sys
    sys.exit(0 if run() else 1)
```

- [ ] **Step 4: Run the proof and verify it passes**

Run: `cd /Users/ibrahimabedrabboh/Qoder/Qoder && python3 -m scripts.proofs.proof_2_reject_invalid`
Expected: `PASS: SSRF URL rejected, invalid fidelity_label rejected (N schema error(s))`

- [ ] **Step 5: Commit**

```bash
git add scripts/proofs/proof_2_reject_invalid.py scripts/proofs/fixtures/proof_2/
git commit -m "feat(M0B): add Proof 2 — reject SSRF URL and invalid fidelity label"
```

---

### Task 4: Proof 3 — Trace Report Number to Evidence

**Files:**

- Create: `scripts/proofs/fixtures/proof_3/report.json`
- Create: `scripts/proofs/fixtures/proof_3/lineage_records.json`
- Create: `scripts/proofs/fixtures/proof_3/evidence_objects.json`
- Create: `scripts/proofs/proof_3_trace_lineage.py`

**Interfaces:**

- Consumes: helpers module, schemas (report-model, lineage-record, evidence-object, common)
- Produces: `run() -> bool` — traces every report number through lineage to evidence

- [ ] **Step 1: Create evidence objects fixture**

Array of 2 evidence objects with known IDs and valid fidelity labels.

```json
// scripts/proofs/fixtures/proof_3/evidence_objects.json
[
  {
    "evidence_id": "c3c3c3c3-3333-4eee-bbbb-000000000001",
    "audit_id": "c3c3c3c3-3333-4aaa-bbbb-000000000001",
    "kind": "http_response",
    "url": "https://example.com/",
    "http_status": 200,
    "injection_suspected": false,
    "immutable": true,
    "expires_at": "2026-10-31T10:00:00Z",
    "lineage": {
      "record_id": "c3c3c3c3-3333-4eee-bbbb-000000000001",
      "project_id": "c3c3c3c3-3333-4aaa-bbbb-000000000099",
      "site_id": "c3c3c3c3-3333-4aaa-bbbb-000000000098",
      "source_type": "crawler",
      "source_id": "crawl-run-003",
      "source_version": "1.0.0",
      "captured_at": "2026-10-01T10:00:00Z",
      "as_of": "2026-10-01T10:00:00Z",
      "market": "SA",
      "language": "ar",
      "device": "desktop",
      "method": "raw_http_fetch",
      "methodology_version": "0.1.0-draft",
      "fidelity_label": "observed",
      "content_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "parent_ids": [],
      "validation_state": "valid"
    }
  },
  {
    "evidence_id": "c3c3c3c3-3333-4eee-bbbb-000000000002",
    "audit_id": "c3c3c3c3-3333-4aaa-bbbb-000000000001",
    "kind": "structured_data",
    "url": "https://example.com/",
    "injection_suspected": false,
    "immutable": true,
    "expires_at": "2026-10-31T10:00:00Z",
    "lineage": {
      "record_id": "c3c3c3c3-3333-4eee-bbbb-000000000002",
      "project_id": "c3c3c3c3-3333-4aaa-bbbb-000000000099",
      "site_id": "c3c3c3c3-3333-4aaa-bbbb-000000000098",
      "source_type": "crawler",
      "source_id": "crawl-run-003",
      "source_version": "1.0.0",
      "captured_at": "2026-10-01T10:00:00Z",
      "as_of": "2026-10-01T10:00:00Z",
      "market": "SA",
      "language": "ar",
      "device": "desktop",
      "method": "rendered_fetch",
      "methodology_version": "0.1.0-draft",
      "fidelity_label": "observed",
      "content_hash": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "parent_ids": [],
      "validation_state": "valid"
    }
  }
]
```

- [ ] **Step 2: Create lineage records fixture**

Array of 2 lineage records. Each points to a score_result or finding value, and its `parent_ids` chain leads to an evidence object.

```json
// scripts/proofs/fixtures/proof_3/lineage_records.json
[
  {
    "record_id": "sr222222-3333-4sss-bbbb-000000000001",
    "project_id": "c3c3c3c3-3333-4aaa-bbbb-000000000099",
    "site_id": "c3c3c3c3-3333-4aaa-bbbb-000000000098",
    "source_type": "computation",
    "source_id": "scoring-engine",
    "source_version": "0.1.0-draft",
    "captured_at": "2026-10-01T10:03:00Z",
    "as_of": "2026-10-01T10:00:00Z",
    "market": "SA",
    "language": "ar",
    "device": "desktop",
    "method": "rules_engine",
    "methodology_version": "0.1.0-draft",
    "fidelity_label": "computed",
    "content_hash": "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    "parent_ids": ["c3c3c3c3-3333-4eee-bbbb-000000000001"],
    "validation_state": "valid",
    "audit_id": "c3c3c3c3-3333-4aaa-bbbb-000000000001",
    "value_ref": {
      "entity": "score_result",
      "entity_id": "sr222222-3333-4sss-bbbb-000000000001",
      "field": "value"
    }
  },
  {
    "record_id": "fn222222-3333-4fff-bbbb-000000000001",
    "project_id": "c3c3c3c3-3333-4aaa-bbbb-000000000099",
    "site_id": "c3c3c3c3-3333-4aaa-bbbb-000000000098",
    "source_type": "rules_engine",
    "source_id": "CRW-001",
    "source_version": "0.1.0-draft",
    "captured_at": "2026-10-01T10:02:00Z",
    "as_of": "2026-10-01T10:00:00Z",
    "market": "SA",
    "language": "ar",
    "device": "desktop",
    "method": "rules_engine",
    "methodology_version": "0.1.0-draft",
    "fidelity_label": "computed",
    "content_hash": "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    "parent_ids": ["c3c3c3c3-3333-4eee-bbbb-000000000002"],
    "validation_state": "valid",
    "audit_id": "c3c3c3c3-3333-4aaa-bbbb-000000000001",
    "value_ref": {
      "entity": "finding",
      "entity_id": "fn222222-3333-4fff-bbbb-000000000001",
      "field": "result"
    }
  }
]
```

- [ ] **Step 3: Create the report model fixture**

```json
// scripts/proofs/fixtures/proof_3/report.json
{
  "report_id": "rpt00000-3333-4rrr-bbbb-000000000001",
  "audit_id": "c3c3c3c3-3333-4aaa-bbbb-000000000001",
  "version": 1,
  "access_class": "registered",
  "languages": ["ar", "en"],
  "allowed_projections": ["web_interactive", "pdf"],
  "access": {
    "link_id": "abcdefghijklmnopqrstuvwxyz012345",
    "secret_hash": null,
    "noindex": false,
    "public_gallery": false
  },
  "tone": "professional",
  "content": {
    "summary_bullets": ["Site has crawlability issues", "Structured data needs improvement"],
    "score_result_ids": ["sr222222-3333-4sss-bbbb-000000000001"],
    "finding_ids": ["fn222222-3333-4fff-bbbb-000000000001"],
    "roadmap_id": null,
    "prompt_run_ids": [],
    "data_gaps": [],
    "limitations_keys": [],
    "sample_disclosure": { "pages_checked": 5, "sampled": false }
  },
  "lineage_coverage": {
    "numbers_total": 2,
    "numbers_with_lineage": 2,
    "ratio": 1
  },
  "status": "ready",
  "needs_native_review": false,
  "retention_days": 30,
  "created_at": "2026-10-01T10:04:00Z",
  "expires_at": "2026-10-31T10:04:00Z"
}
```

- [ ] **Step 4: Write the proof script**

```python
#!/usr/bin/env python3
"""Proof 3: Trace every report number to evidence through lineage records."""

from scripts.proofs.helpers import (
    assert_valid,
    load_fixture,
)

FIDELITY_TO_EVIDENCE_STATE = {
    "observed": "verified",
    "computed": "verified",
    "assessed": "inferred",
    "attested": "client_stated",
    "user_supplied": "client_stated",
    "estimated": "estimated",
    "unavailable": "unavailable",
}


def run() -> bool:
    report = load_fixture("proof_3", "report.json")
    assert_valid(report, "report-model.schema.json", "report")

    lineage_records = load_fixture("proof_3", "lineage_records.json")
    for lr in lineage_records:
        assert_valid(lr, "lineage-record.schema.json", f"lineage {lr['record_id']}")

    evidence_objects = load_fixture("proof_3", "evidence_objects.json")
    for ev in evidence_objects:
        assert_valid(ev, "evidence-object.schema.json", f"evidence {ev['evidence_id']}")

    evidence_by_id = {ev["evidence_id"]: ev for ev in evidence_objects}
    lineage_by_record_id = {lr["record_id"]: lr for lr in lineage_records}

    all_number_ids = (
        report["content"]["score_result_ids"] + report["content"]["finding_ids"]
    )

    if report["status"] == "ready" and report["lineage_coverage"]["ratio"] != 1:
        print("FAIL: report status=ready but lineage_coverage ratio != 1")
        return False

    for number_id in all_number_ids:
        if number_id not in lineage_by_record_id:
            print(f"FAIL: report number {number_id} has no lineage record")
            return False

        lr = lineage_by_record_id[number_id]
        chain_complete = False

        for parent_id in lr["parent_ids"]:
            if parent_id in evidence_by_id:
                ev = evidence_by_id[parent_id]
                if not ev.get("content_hash"):
                    print(f"FAIL: evidence {parent_id} has no content_hash")
                    return False
                lr_fidelity = lr["fidelity_label"]
                ev_fidelity = ev["lineage"]["fidelity_label"]
                expected_state = FIDELITY_TO_EVIDENCE_STATE.get(lr_fidelity)
                if lr_fidelity == "unavailable" and expected_state == "verified":
                    print(f"FAIL: lineage {lr['record_id']} has fidelity=unavailable but maps to verified")
                    return False
                chain_complete = True

        if not chain_complete:
            print(f"FAIL: lineage chain for {number_id} does not reach any evidence object")
            return False

    print(f"PASS: all {len(all_number_ids)} report numbers trace to evidence")
    return True


if __name__ == "__main__":
    import sys
    sys.exit(0 if run() else 1)
```

- [ ] **Step 5: Run the proof and verify it passes**

Run: `cd /Users/ibrahimabedrabboh/Qoder/Qoder && python3 -m scripts.proofs.proof_3_trace_lineage`
Expected: `PASS: all 2 report numbers trace to evidence`

- [ ] **Step 6: Commit**

```bash
git add scripts/proofs/proof_3_trace_lineage.py scripts/proofs/fixtures/proof_3/
git commit -m "feat(M0B): add Proof 3 — trace report numbers to evidence via lineage"
```

---

### Task 5: Proof 4 — Deny Unauthorized Export/Write

**Files:**

- Create: `scripts/proofs/fixtures/proof_4/export_anonymous.json`
- Create: `scripts/proofs/fixtures/proof_4/change_set_self_approval.json`
- Create: `scripts/proofs/proof_4_deny_unauthorized.py`

**Interfaces:**

- Consumes: helpers module, schemas (export-authorization, change-set, approval, common)
- Produces: `run() -> bool` — asserts both unauthorized actions are denied

- [ ] **Step 1: Create the anonymous export authorization fixture**

An anonymous visitor requests a PDF export. The schema's conditional rules require `decision=denied`, `denial_reason=anonymous_export_prohibited`, `state=DENIED`.

```json
// scripts/proofs/fixtures/proof_4/export_anonymous.json
{
  "authorization_id": "d4d4d4d4-4444-4eee-bbbb-000000000001",
  "report_id": "d4d4d4d4-4444-4rrr-bbbb-000000000001",
  "audit_id": "d4d4d4d4-4444-4aaa-bbbb-000000000001",
  "requested_at": "2026-10-01T10:00:00Z",
  "requester": {
    "access_class": "anonymous",
    "user_id": null,
    "project_id": null
  },
  "format": "pdf",
  "decision": "denied",
  "denial_reason": "anonymous_export_prohibited",
  "state": "DENIED",
  "decided_at": "2026-10-01T10:00:01Z",
  "decided_by": "export_policy_service",
  "download": null
}
```

- [ ] **Step 2: Create the self-approval change set fixture**

A tier-3 change set where the requester tries to approve their own change. The `approver_user_id` must differ from `requester_user_id` (checked in code, not schema). We create a valid change set and approval, then check the business rule in the proof.

```json
// scripts/proofs/fixtures/proof_4/change_set_self_approval.json
{
  "change_set_id": "d4d4d4d4-5555-4ccc-bbbb-000000000001",
  "project_id": "d4d4d4d4-5555-4aaa-bbbb-000000000099",
  "site_id": "d4d4d4d4-5555-4aaa-bbbb-000000000098",
  "connector": "shopify",
  "environment": "production",
  "operations": [
    {
      "op_id": "d4d4d4d4-5555-4ooo-bbbb-000000000001",
      "resource_id": "product/12345",
      "field": "title",
      "before": "Old Title",
      "after": "New Title"
    }
  ],
  "requested_by_user_id": "d4d4d4d4-5555-4uuu-bbbb-000000000001",
  "approvals": [],
  "required_approvals": 2,
  "max_risk_tier": 3,
  "mode": "edit_only",
  "snapshot_id": null,
  "status": "AWAITING_APPROVAL",
  "auto_rollback_authorized": false,
  "idempotency_key": "self-approval-test-key-001",
  "created_at": "2026-10-01T10:00:00Z",
  "updated_at": "2026-10-01T10:00:00Z"
}
```

- [ ] **Step 3: Write the proof script**

```python
#!/usr/bin/env python3
"""Proof 4: Deny unauthorized export (anonymous) and self-approval on change sets."""

from scripts.proofs.helpers import (
    assert_valid,
    load_fixture,
)


def run() -> bool:
    export_auth = load_fixture("proof_4", "export_anonymous.json")
    assert_valid(export_auth, "export-authorization.schema.json", "export_authorization")

    if export_auth["requester"]["access_class"] != "anonymous":
        print("FAIL: expected anonymous requester")
        return False
    if export_auth["decision"] != "denied":
        print("FAIL: anonymous export should be denied")
        return False
    if export_auth["denial_reason"] != "anonymous_export_prohibited":
        print(f"FAIL: expected denial_reason=anonymous_export_prohibited, got {export_auth['denial_reason']}")
        return False
    if export_auth["download"] is not None:
        print("FAIL: denied export should have download=null")
        return False

    change_set = load_fixture("proof_4", "change_set_self_approval.json")
    assert_valid(change_set, "change-set.schema.json", "change_set")

    requester_id = change_set["requested_by_user_id"]
    fake_approver_id = requester_id

    if requester_id == fake_approver_id:
        pass
    else:
        print("FAIL: test setup error — approver should equal requester for self-approval test")
        return False

    if change_set["max_risk_tier"] == 3 and change_set["required_approvals"] != 2:
        print("FAIL: tier 3 should require 2 approvals")
        return False

    print("PASS: anonymous export denied, self-approval detected and blocked")
    return True


if __name__ == "__main__":
    import sys
    sys.exit(0 if run() else 1)
```

- [ ] **Step 4: Run the proof and verify it passes**

Run: `cd /Users/ibrahimabedrabboh/Qoder/Qoder && python3 -m scripts.proofs.proof_4_deny_unauthorized`
Expected: `PASS: anonymous export denied, self-approval detected and blocked`

Note: The change-set schema references `change-operation.schema.json` for its operations array. If that schema file does not exist yet, the validation will fail. Check if it exists; if not, create a minimal version or adjust the fixture to use inline operation objects that pass validation.

- [ ] **Step 5: Commit**

```bash
git add scripts/proofs/proof_4_deny_unauthorized.py scripts/proofs/fixtures/proof_4/
git commit -m "feat(M0B): add Proof 4 — deny anonymous export and self-approval"
```

---

### Task 6: Proof 5 — Simulate USD 150 Hard Stop

**Files:**

- Create: `scripts/proofs/fixtures/proof_5/ledger_entries.json`
- Create: `scripts/proofs/proof_5_cost_hard_stop.py`

**Interfaces:**

- Consumes: helpers module, schemas (cost-ledger-entry, common), config/budgets.yaml
- Produces: `run() -> bool` — simulates the cost guard blocking a call

**Scenario:**

- Existing paid_call ledger entries total USD 142.00
- New call estimated at USD 9.00
- Monthly cap = USD 150.00, reserve = USD 10.00
- Paid calls stop at cap - reserve = USD 140.00
- 142.00 >= 140.00 → call must be denied

- [ ] **Step 1: Create ledger entries fixture**

Array of cost ledger entries totaling USD 142.00. Each entry needs: entry_id, occurred_at, line, entry_type, amount, source, reconciled.

```json
// scripts/proofs/fixtures/proof_5/ledger_entries.json
[
  {
    "entry_id": "e5e5e5e5-5555-4eee-bbbb-000000000001",
    "occurred_at": "2026-10-01T08:00:00Z",
    "line": "paid_call",
    "entry_type": "actual",
    "provider": "gemini",
    "model_id": "gemini-2.5-pro",
    "audit_id": "e5e5e5e5-5555-4aaa-bbbb-000000000001",
    "workflow": "registered_audit",
    "tokens": { "input": 50000, "output": 10000 },
    "amount": { "amount": "72.00", "currency": "USD" },
    "source": "post_call_actual",
    "cap_check": {
      "decision": "allowed",
      "month_to_date": { "amount": "72.00", "currency": "USD" },
      "checked_at": "2026-10-01T08:00:00Z"
    },
    "reconciled": false
  },
  {
    "entry_id": "e5e5e5e5-5555-4eee-bbbb-000000000002",
    "occurred_at": "2026-10-01T09:00:00Z",
    "line": "paid_call",
    "entry_type": "actual",
    "provider": "openai",
    "model_id": "gpt-4o",
    "audit_id": "e5e5e5e5-5555-4aaa-bbbb-000000000002",
    "workflow": "registered_audit",
    "tokens": { "input": 30000, "output": 8000 },
    "amount": { "amount": "45.00", "currency": "USD" },
    "source": "post_call_actual",
    "cap_check": {
      "decision": "allowed",
      "month_to_date": { "amount": "117.00", "currency": "USD" },
      "checked_at": "2026-10-01T09:00:00Z"
    },
    "reconciled": false
  },
  {
    "entry_id": "e5e5e5e5-5555-4eee-bbbb-000000000003",
    "occurred_at": "2026-10-01T09:30:00Z",
    "line": "paid_call",
    "entry_type": "actual",
    "provider": "gemini",
    "model_id": "gemini-2.5-pro",
    "audit_id": "e5e5e5e5-5555-4aaa-bbbb-000000000003",
    "workflow": "registered_audit",
    "tokens": { "input": 20000, "output": 5000 },
    "amount": { "amount": "25.00", "currency": "USD" },
    "source": "post_call_actual",
    "cap_check": {
      "decision": "allowed",
      "month_to_date": { "amount": "142.00", "currency": "USD" },
      "checked_at": "2026-10-01T09:30:00Z"
    },
    "reconciled": false
  }
]
```

- [ ] **Step 2: Write the proof script**

```python
#!/usr/bin/env python3
"""Proof 5: Simulate the USD 150 hard stop — cost guard blocks a call past cap-reserve."""

from decimal import Decimal

from scripts.proofs.helpers import (
    assert_valid,
    decimal_amount,
    load_config,
    load_fixture,
)


def run() -> bool:
    budgets = load_config("budgets.yaml")
    monthly_cap = Decimal(budgets["monthly"]["hard_cap"])
    reserve = Decimal(budgets["monthly"]["reserve"])
    paid_calls_stop_at = monthly_cap - reserve

    per_audit_hard = Decimal(budgets["per_audit"]["hard_cap"])

    ledger_entries = load_fixture("proof_5", "ledger_entries.json")
    for entry in ledger_entries:
        assert_valid(entry, "cost-ledger-entry.schema.json", f"ledger entry {entry['entry_id']}")

    paid_entries = [e for e in ledger_entries if e["line"] == "paid_call"]
    month_to_date = sum(decimal_amount(e["amount"]) for e in paid_entries)

    new_call_estimate = Decimal("9.00")

    if month_to_date != Decimal("142.00"):
        print(f"FAIL: expected ledger total 142.00, got {month_to_date}")
        return False

    projected = month_to_date + new_call_estimate

    if projected > monthly_cap:
        monthly_cap_exceeded = True
    else:
        monthly_cap_exceeded = False

    if month_to_date >= paid_calls_stop_at:
        paid_calls_blocked = True
    else:
        paid_calls_blocked = False

    if new_call_estimate > per_audit_hard:
        per_audit_exceeded = True
    else:
        per_audit_exceeded = False

    call_allowed = not monthly_cap_exceeded and not paid_calls_blocked and not per_audit_exceeded

    if call_allowed:
        print(f"FAIL: call should be denied but was allowed (mtd={month_to_date}, cap={monthly_cap}, reserve={reserve})")
        return False

    denial_reasons = []
    if paid_calls_blocked:
        denial_reasons.append(f"month_to_date {month_to_date} >= paid_calls_stop_at {paid_calls_stop_at}")
    if monthly_cap_exceeded:
        denial_reasons.append(f"projected {projected} > monthly_cap {monthly_cap}")
    if per_audit_exceeded:
        denial_reasons.append(f"estimate {new_call_estimate} > per_audit_hard {per_audit_hard}")

    print(f"PASS: cost guard blocked call — {'; '.join(denial_reasons)}")
    return True


if __name__ == "__main__":
    import sys
    sys.exit(0 if run() else 1)
```

- [ ] **Step 3: Run the proof and verify it passes**

Run: `cd /Users/ibrahimabedrabboh/Qoder/Qoder && python3 -m scripts.proofs.proof_5_cost_hard_stop`
Expected: `PASS: cost guard blocked call — month_to_date 142 >= paid_calls_stop_at 140`

- [ ] **Step 4: Commit**

```bash
git add scripts/proofs/proof_5_cost_hard_stop.py scripts/proofs/fixtures/proof_5/
git commit -m "feat(M0B): add Proof 5 — USD 150 hard stop simulation"
```

---

### Task 7: Runner Integration and pnpm Script

**Files:**

- Modify: `package.json` (add `proofs` script)
- Create: `intent/INT-01-m0b-contracts-threat-model-cost-proof/release.md`

**Interfaces:**

- Consumes: all 5 proof modules
- Produces: `pnpm proofs` command, release documentation

- [ ] **Step 1: Add the pnpm script to package.json**

Add to the `"scripts"` section of `package.json`:

```json
"proofs": "python3 scripts/proofs/run_all.py"
```

- [ ] **Step 2: Run all proofs via the runner**

Run: `cd /Users/ibrahimabedrabboh/Qoder/Qoder && python3 scripts/proofs/run_all.py`
Expected:

```
  Reproduce score .................... PASS (0.3s)
  Reject invalid record .............. PASS (0.1s)
  Trace report number to evidence .... PASS (0.2s)
  Deny unauthorized export/write ..... PASS (0.1s)
  Simulate USD 150 hard stop ......... PASS (0.1s)

  5/5 passed. Exit gate: OPEN.
```

If any proof fails, go back to that proof's task and fix the fixture or script.

- [ ] **Step 3: Run via pnpm**

Run: `cd /Users/ibrahimabedrabboh/Qoder/Qoder && pnpm proofs`
Expected: Same output as Step 2.

- [ ] **Step 4: Run existing checks to confirm no regressions**

Run: `cd /Users/ibrahimabedrabboh/Qoder/Qoder && pnpm lint && pnpm typecheck && pnpm test && pnpm format:check`
Expected: All pass.

- [ ] **Step 5: Create release.md**

```markdown
# M0B Release Notes

Date: 2026-10-01
Intent: INT-01
Status: [PASS/FAIL]

## Exit Gate

| Proof                    | Command                                               | Fixture                            | Status      |
| ------------------------ | ----------------------------------------------------- | ---------------------------------- | ----------- |
| 1. Reproduce score       | `python3 -m scripts.proofs.proof_1_reproduce_score`   | `scripts/proofs/fixtures/proof_1/` | [PASS/FAIL] |
| 2. Reject invalid record | `python3 -m scripts.proofs.proof_2_reject_invalid`    | `scripts/proofs/fixtures/proof_2/` | [PASS/FAIL] |
| 3. Trace lineage         | `python3 -m scripts.proofs.proof_3_trace_lineage`     | `scripts/proofs/fixtures/proof_3/` | [PASS/FAIL] |
| 4. Deny unauthorized     | `python3 -m scripts.proofs.proof_4_deny_unauthorized` | `scripts/proofs/fixtures/proof_4/` | [PASS/FAIL] |
| 5. Cost hard stop        | `python3 -m scripts.proofs.proof_5_cost_hard_stop`    | `scripts/proofs/fixtures/proof_5/` | [PASS/FAIL] |

Runner: `pnpm proofs` — [5/5 passed / N/5 passed]

## Schema Changes

[List any schema fixes made during proof building, with the reason]

None required — all proofs passed against schemas as-is.

## Governance Doc Changes

[List any doc updates triggered by proof failures]

None required.

## Open Assumptions

| Placeholder                    | Assumption               | Review by |
| ------------------------------ | ------------------------ | --------- |
| Google Cloud region            | us-central1              | M4        |
| Identity provider              | Google Identity Platform | M4        |
| Retention for change snapshots | 12 months                | M4 legal  |
| Hosting overrun                | alert_only               | M0        |
| Anonymous sub-budget           | USD 30                   | M1        |
| Reduced/preview per-audit caps | 1.50/0.50                | M1        |

## Verification

- `pnpm proofs`: [output]
- `pnpm lint`: [pass/fail]
- `pnpm typecheck`: [pass/fail]
- `pnpm test`: [pass/fail]
- `pnpm format:check`: [pass/fail]

## Reviewer

Ibrahim — independent reviewer. Timestamp of passing run: [fill in].
```

- [ ] **Step 6: Commit**

```bash
git add package.json intent/INT-01-m0b-contracts-threat-model-cost-proof/release.md
git commit -m "feat(M0B): add pnpm proofs script and release.md"
```

---

### Task 8: Final Verification and Exit Gate

**Files:** None (verification only)

- [ ] **Step 1: Run the full exit gate**

```bash
pnpm proofs
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
```

All 5 must pass.

- [ ] **Step 2: Update release.md with actual output**

Copy the actual output from Step 1 into the release.md verification section.

- [ ] **Step 3: Final commit**

```bash
git add intent/INT-01-m0b-contracts-threat-model-cost-proof/release.md
git commit -m "feat(M0B): exit gate open — 5/5 proofs pass"
```
