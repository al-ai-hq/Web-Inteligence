#!/usr/bin/env python3
"""Run the five M0B exit proofs locally.

No network, no provider call, no cloud resource. Product spend is 0.00 USD.
The combined USD 150 cap stays an assumption (D-005, OI-001).
"""

from __future__ import annotations

import json
import sys
from decimal import Decimal
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

ROOT = Path(__file__).resolve().parent.parent
SCHEMA_DIR = ROOT / "schemas"
FIXTURE_DIR = ROOT / "evals" / "m0b"
sys.path.insert(0, str(ROOT / "scripts"))
import check_schemas  # noqa: E402
from check_config import WRITE_CLASS_TOOLS  # noqa: E402

RULES = (
    ("CRW-001", "crawlability"),
    ("SEO-001", "on_page"),
    ("STR-001", "structured_data"),
    ("AEO-001", "aeo"),
    ("GEO-001", "geo"),
    ("I18N-001", "i18n_accessibility"),
    ("PRF-001", "performance_security"),
)
PASS_VALUE = Decimal("1.00")
FIDELITY_TO_EVIDENCE = {
    "observed": "verified",
    "computed": "verified",
    "assessed": "inferred",
    "attested": "client_stated",
    "user_supplied": "client_stated",
    "estimated": "estimated",
    "unavailable": "unavailable",
}


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    raise SystemExit(1)


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def registry_and_validators():
    docs = {}
    for path in sorted(SCHEMA_DIR.glob("*.schema.json")):
        docs[path.name] = json.loads(path.read_text(encoding="utf-8"))
    registry = Registry()
    for name, doc in docs.items():
        resource = Resource.from_contents(doc, default_specification=DRAFT202012)
        registry = registry.with_resources([(doc["$id"], resource), (name, resource)])

    def validator_for(stem: str) -> Draft202012Validator:
        return Draft202012Validator(
            docs[f"{stem}.schema.json"],
            registry=registry,
            format_checker=Draft202012Validator.FORMAT_CHECKER,
        )

    return validator_for


def require_valid(validator, instance, label: str) -> None:
    errors = sorted(validator.iter_errors(instance), key=lambda item: list(item.absolute_path))
    if errors:
        first = errors[0]
        where = "/".join(str(part) for part in first.absolute_path) or "(root)"
        fail(f"{label} is not schema-valid at {where}: {first.message}")


def money(value: str) -> Decimal:
    amount = Decimal(value)
    if amount != amount.quantize(Decimal("0.01")):
        fail(f"money value {value} is not a 2-decimal USD string")
    return amount


def load_weights():
    scoring = yaml.safe_load((ROOT / "config" / "scoring.yaml").read_text(encoding="utf-8"))
    if scoring["methodology_version"] != "0.1.0-draft":
        fail("methodology_version changed")
    weights = {name: category["weight"] for name, category in scoring["categories"].items()}
    expected = {
        "crawlability": 20,
        "on_page": 15,
        "structured_data": 10,
        "aeo": 20,
        "geo": 15,
        "i18n_accessibility": 10,
        "performance_security": 10,
    }
    if weights != expected:
        fail(f"category weights changed: {weights}")
    return weights


def load_stop_line() -> Decimal:
    budgets = yaml.safe_load((ROOT / "config" / "budgets.yaml").read_text(encoding="utf-8"))
    if budgets["currency"] != "USD":
        fail("budget currency is not USD")
    hard_cap = money(budgets["monthly"]["hard_cap"])
    reserve = money(budgets["monthly"]["reserve"])
    if hard_cap != Decimal("150.00") or reserve != Decimal("10.00"):
        fail("hard cap or reserve differs from the Stage 1 proof")
    if budgets["monthly"]["paid_calls_stop_at"] != "cap_minus_reserve":
        fail("paid_calls_stop_at is not cap_minus_reserve")
    return hard_cap - reserve


def reproduce_score(validator_for) -> None:
    fixture = load_json(FIXTURE_DIR / "score-fixture.json")
    weights = load_weights()
    rows = fixture["rules"]
    if [(row["rule_id"], row["category"]) for row in rows] != list(RULES):
        fail("score fixture rules are not the seven named pass rules")
    by_category = {}
    seen_ids = []
    for row in rows:
        if row["importance_weight"] != 1 or row["rule_result"]["result"] != "pass":
            fail(f"{row['rule_id']} is not importance 1 and pass")
        require_valid(validator_for("rule-result"), row["rule_result"], row["rule_id"])
        by_category[row["category"]] = Decimal(100) * PASS_VALUE * Decimal(1) / Decimal(1)
        seen_ids.append(row["rule_result"]["rule_result_id"])
    readiness = sum(by_category[name] * Decimal(weights[name]) / Decimal(100) for name in weights)
    if readiness != Decimal(100):
        fail(f"recomputed readiness is {readiness}")
    score = fixture["score"]
    require_valid(validator_for("score-result"), score, "score")
    if score["score_kind"] != "presence_readiness":
        fail("score kind is not presence readiness")
    if score["methodology_version"] != "0.1.0-draft":
        fail("stored methodology_version differs")
    if Decimal(str(score["value"])) != Decimal(100) or Decimal(str(score["pre_cap_value"])) != Decimal(100):
        fail("stored score is not 100")
    if score.get("applied_cap") not in (None,):
        fail("a critical cap is present")
    if score["rule_result_ids"] != seen_ids:
        fail("score does not point at the seven rule results")
    if "experience" in json.dumps(fixture):
        fail("experience effectiveness is in the score fixture")
    print("OK: reproduce one score 100")


def reject_invalid_record(validator_for) -> None:
    validator = validator_for("report-model")
    base = load_json(SCHEMA_DIR / "examples" / "report-model.example.json")
    spec = load_json(SCHEMA_DIR / "examples" / "invalid" / "report-model.ready-without-full-lineage.invalid.json")
    if not validator.is_valid(base):
        fail("valid report example does not validate")
    patched = check_schemas.apply_patch(base, spec["patch"])
    if validator.is_valid(patched):
        fail("ready report without full lineage was accepted")
    print("OK: reject one invalid record")


def trace_report(validator_for) -> None:
    fixture = load_json(FIXTURE_DIR / "trace-fixture.json")
    require_valid(validator_for("audit"), fixture["audit"], "trace audit")
    require_valid(validator_for("evidence-object"), fixture["evidence"], "trace evidence")
    require_valid(validator_for("score-result"), fixture["score"], "trace score")
    require_valid(validator_for("report-model"), fixture["report"], "trace report")
    errors = trace_errors(fixture)
    if errors:
        fail("; ".join(errors))
    broken = json.loads(json.dumps(fixture))
    for row in broken["rules"]:
        if row["rule_result"]["rule_id"] == "CRW-001":
            row["rule_result"]["evidence_ids"] = []
    if not trace_errors(broken):
        fail("a missing evidence link was accepted")
    print("OK: trace one report number")


def trace_errors(fixture) -> list[str]:
    errors = []
    audit = fixture["audit"]
    evidence = fixture["evidence"]
    score = fixture["score"]
    report = fixture["report"]
    rules = {row["rule_result"]["rule_result_id"]: row["rule_result"] for row in fixture["rules"]}
    if report["content"]["score_result_ids"] != [score["score_result_id"]]:
        errors.append("report headline does not point at the score")
    if score["audit_id"] != audit["audit_id"] or report["audit_id"] != audit["audit_id"]:
        errors.append("score or report audit_id does not match")
    if Decimal(str(score["value"])) != Decimal(100):
        errors.append("headline is not 100")
    label = score["lineage"]["fidelity_label"]
    if label != "computed" or FIDELITY_TO_EVIDENCE[label] != "verified":
        errors.append("computed fidelity was not kept and mapped to verified")
    if score["rule_result_ids"] != list(rules):
        errors.append("score does not point at the rule results")
    crw = next(row["rule_result"] for row in fixture["rules"] if row["rule_result"]["rule_id"] == "CRW-001")
    if evidence["evidence_id"] not in crw["evidence_ids"]:
        errors.append("CRW-001 does not point at the evidence object")
    if evidence["lineage"]["fidelity_label"] != "observed":
        errors.append("evidence fidelity is not observed")
    if evidence["lineage"]["parent_ids"] != []:
        errors.append("observed evidence has parents")
    if audit["project_id"] is None:
        errors.append("trace audit has no project")
    chain = [score["lineage"], evidence["lineage"]]
    chain.extend(row["rule_result"]["lineage"] for row in fixture["rules"])
    for item in chain:
        if item["project_id"] != audit["project_id"]:
            errors.append("lineage project_id does not match the audit")
            break
    return errors


def deny_export(validator_for) -> None:
    fixture = load_json(FIXTURE_DIR / "export-fixture.json")
    decision = export_decision(fixture["request"])
    if decision != {
        "decision": "denied",
        "denial_reason": "anonymous_export_prohibited",
        "artifact": None,
    }:
        fail(f"anonymous csv decision was {decision}")
    stored = fixture["authorization"]
    require_valid(validator_for("export-authorization"), stored, "export authorization")
    if stored["format"] != "csv" or stored["decision"] != "denied":
        fail("stored authorization is not a denied csv")
    if stored["denial_reason"] != "anonymous_export_prohibited" or stored["download"] is not None:
        fail("stored authorization created an artifact or used another reason")
    negative = load_json(
        SCHEMA_DIR / "examples" / "invalid" / "export-authorization.anonymous-authorized.invalid.json"
    )
    base = load_json(SCHEMA_DIR / "examples" / negative["base_example"])
    patched = check_schemas.apply_patch(base, negative["patch"])
    if validator_for("export-authorization").is_valid(patched):
        fail("anonymous authorized export was accepted")
    agent = yaml.safe_load((ROOT / "config" / "agents" / "fixer.yaml").read_text(encoding="utf-8"))
    overlap = WRITE_CLASS_TOOLS.intersection(agent["tools"])
    if overlap:
        fail(f"fixer tools include write-class names: {sorted(overlap)}")
    print("OK: deny anonymous csv export")


def export_decision(request: dict) -> dict:
    if request["access_class"] == "anonymous":
        return {
            "decision": "denied",
            "denial_reason": "anonymous_export_prohibited",
            "artifact": None,
        }
    fail("this proof only decides the anonymous export")
    return {}


def hard_stop() -> None:
    threshold = load_stop_line()
    if threshold != Decimal("140.00"):
        fail(f"stop line is {threshold}")
    fixture = load_json(FIXTURE_DIR / "cost-fixture.json")
    if fixture["cap_assumption"] != "unconfirmed":
        fail("cap assumption is not labelled unconfirmed")
    hosting = fixture["hosting"]
    if hosting["amount"] != "25.00" or hosting["currency"] != "USD" or hosting["fidelity_label"] != "estimated":
        fail("hosting line is not the estimated 25.00 USD")
    if fixture["hosting_stopped"] is not False:
        fail("the proof stops hosting")
    cases = {case["name"]: case for case in fixture["cases"]}
    refuse_case = cases["refuse"]
    allow_case = cases["allow"]
    if not call_refused(refuse_case, threshold):
        fail("140.00 + 0.01 was allowed")
    if call_refused(allow_case, threshold):
        fail("139.99 + 0.01 was refused")
    outcome = fixture["on_refuse"]
    if outcome["ai_visibility"] != "unavailable" or outcome["reason"] != "unavailable due to the monthly limit":
        fail("AI visibility was not unavailable for the monthly limit")
    if outcome["presence_readiness"] != 100:
        fail("deterministic score did not remain")
    print("OK: hard stop at 140.00 USD (cap assumption unconfirmed)")
    print("hosting 25.00 USD is estimated and is not stopped")
    print("paid calls at 140.00 plus hosting 25.00 can exceed 150.00 until OI-031")


def call_refused(case: dict, threshold: Decimal) -> bool:
    paid = money(case["paid_calls_to_date"])
    proposed = money(case["proposed_call"])
    return paid + proposed > threshold


def parent_joins(validator_for) -> None:
    fixture = load_json(FIXTURE_DIR / "project-joins.json")
    valid = fixture["valid"]
    for stem, instance in (
        ("audit", valid["audit"]),
        ("audit", valid["anonymous_audit"]),
        ("change-set", valid["change_set"]),
        ("approval", valid["approval"]),
        ("snapshot", valid["snapshot"]),
        ("verification", valid["verification"]),
        ("report-model", valid["report"]),
        ("report-model", valid["anonymous_report"]),
        ("deletion-request", valid["deletion_request"]),
        ("webhook-event", valid["webhook"]),
    ):
        require_valid(validator_for(stem), instance, stem)
    if join_errors(valid):
        fail("valid parent joins failed: " + "; ".join(join_errors(valid)))
    project_id = valid["audit"]["project_id"]
    if visible_report_ids(valid, project_id) != [valid["report"]["report_id"]]:
        fail("project query did not return only the registered report")
    if visible_report_ids(valid, "22222222-2222-4222-8222-222222222223"):
        fail("a foreign project saw a report")
    if visible_report_ids(valid, None):
        fail("a null project query returned a report")
    broken = fixture["broken"]
    expectations = {
        "approval_dangling": lambda bundle: "approval parent" in " ".join(join_errors(bundle)),
        "snapshot_dangling": lambda bundle: "snapshot parent" in " ".join(join_errors(bundle)),
        "verification_dangling": lambda bundle: "verification parent" in " ".join(join_errors(bundle)),
        "duplicate_op": lambda bundle: "op_id" in " ".join(join_errors(bundle)),
        "orphan_op": lambda bundle: "op_id" in " ".join(join_errors(bundle)),
        "report_missing_audit": lambda bundle: "report parent" in " ".join(join_errors(bundle)),
        "deletion_missing_audit": lambda bundle: "deletion parent" in " ".join(join_errors(bundle)),
        "webhook_null_site": lambda bundle: "unscoped" in " ".join(join_errors(bundle)),
        "site_project_conflict": lambda bundle: "site" in " ".join(join_errors(bundle)),
    }
    for name, expect in expectations.items():
        bundle = json.loads(json.dumps(valid))
        apply_break(bundle, name, broken[name])
        if not expect(bundle):
            fail(f"broken parent case {name} was accepted: {join_errors(bundle)}")
    print("OK: parent joins")


def apply_break(bundle: dict, name: str, payload) -> None:
    if name == "approval_dangling":
        bundle["approval"] = payload
    elif name == "snapshot_dangling":
        bundle["snapshot"] = payload
    elif name == "verification_dangling":
        bundle["verification"] = payload
    elif name == "duplicate_op":
        bundle["extra_change_sets"] = [payload]
    elif name == "orphan_op":
        bundle["orphan_op_ids"] = [payload]
    elif name == "report_missing_audit":
        bundle["report"] = payload
    elif name == "deletion_missing_audit":
        bundle["deletion_request"] = payload
    elif name == "webhook_null_site":
        bundle["webhook"] = payload
    elif name == "site_project_conflict":
        bundle["extra_audits"] = [payload]
    else:
        fail(f"unknown break {name}")


def change_sets_of(bundle: dict) -> list[dict]:
    sets = [bundle["change_set"]]
    sets.extend(bundle.get("extra_change_sets", []))
    return sets


def audits_of(bundle: dict) -> list[dict]:
    rows = [bundle["audit"], bundle["anonymous_audit"]]
    rows.extend(bundle.get("extra_audits", []))
    return rows


def join_errors(bundle: dict) -> list[str]:
    errors = []
    sets = change_sets_of(bundle)
    audits = audits_of(bundle)
    audits_by_id = {row["audit_id"]: row for row in audits}
    if len(audits_by_id) != len(audits):
        errors.append("duplicate audit_id")
    change_ids = [row["change_set_id"] for row in sets]
    if len(change_ids) != len(set(change_ids)):
        errors.append("duplicate change_set_id")

    def one_change_set(record: dict, label: str) -> None:
        matches = [row for row in sets if row["change_set_id"] == record["change_set_id"]]
        if len(matches) != 1:
            errors.append(f"{label} parent missing")

    one_change_set(bundle["approval"], "approval")
    one_change_set(bundle["snapshot"], "snapshot")
    one_change_set(bundle["verification"], "verification")

    counts: dict[str, int] = {}
    for change_set in sets:
        for operation in change_set["operations"]:
            counts[operation["op_id"]] = counts.get(operation["op_id"], 0) + 1
    for op_id in bundle.get("orphan_op_ids", []):
        counts[op_id] = counts.get(op_id, 0)
    for op_id, count in counts.items():
        if count != 1:
            errors.append(f"op_id {op_id} appears {count} times")

    reports = (bundle["report"], bundle["anonymous_report"])
    link_ids = [report["access"]["link_id"] for report in reports]
    if len(link_ids) != len(set(link_ids)):
        errors.append("link_id reused")
    for report in reports:
        if report["audit_id"] not in audits_by_id:
            errors.append("report parent missing")
    deletion = bundle["deletion_request"]
    if deletion["subject_type"] != "audit" or deletion["subject_id"] not in audits_by_id:
        errors.append("deletion parent missing")

    webhook = bundle["webhook"]
    if webhook.get("site_id") is None:
        errors.append("webhook unscoped")
    else:
        matched = [row for row in audits if row.get("site_id") == webhook["site_id"]]
        projects = {row.get("project_id") for row in matched}
        if not matched:
            errors.append("webhook site has no audit")
        elif len(projects) != 1 or None in projects:
            errors.append("webhook site maps to more than one project")
    return errors


def visible_report_ids(bundle: dict, project_id: str | None) -> list[str]:
    if not project_id:
        return []
    audits = {row["audit_id"]: row for row in audits_of(bundle)}
    visible = []
    for report in (bundle["report"], bundle["anonymous_report"]):
        audit = audits.get(report["audit_id"])
        if audit and audit.get("project_id") == project_id:
            visible.append(report["report_id"])
    return visible


def main() -> int:
    validator_for = registry_and_validators()
    reproduce_score(validator_for)
    reject_invalid_record(validator_for)
    trace_report(validator_for)
    deny_export(validator_for)
    hard_stop()
    parent_joins(validator_for)
    print("product spend 0.00 USD")
    return 0


if __name__ == "__main__":
    sys.exit(main())
