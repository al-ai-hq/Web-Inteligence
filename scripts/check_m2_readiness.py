#!/usr/bin/env python3
"""Recompute one local Presence Readiness score and check its disclosure.

No network, no provider call, no client-site fetch. Product spend is 0.00 USD.
Does not import scripts/check_m0b_proofs.py or the marketing-seo-agent scripts.
"""

from __future__ import annotations

import copy
import json
import sys
from decimal import Decimal
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
FIXTURE_DIR = ROOT / "evals" / "m2"
SCORING_PATH = ROOT / "config" / "scoring.yaml"

RULES = (
    ("CRW-001", "crawlability"),
    ("SEO-001", "on_page"),
    ("STR-001", "structured_data"),
    ("AEO-001", "aeo"),
    ("GEO-001", "geo"),
    ("I18N-001", "i18n_accessibility"),
    ("PRF-001", "performance_security"),
)
EXPECTED_WEIGHTS = {
    "crawlability": 20,
    "on_page": 15,
    "structured_data": 10,
    "aeo": 20,
    "geo": 15,
    "i18n_accessibility": 10,
    "performance_security": 10,
}
FORBIDDEN = ("experience_effectiveness", "ai_visibility", "search_performance")
NON_MEASURED = ("not_applicable", "unavailable", "error")
BANNED_TEXT = ("llms.txt", "rich result", "rich_result", "faq")


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    raise SystemExit(1)


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def scoring_errors(scoring: dict) -> list[str]:
    errors = []
    if scoring.get("methodology_version") != "0.1.0-draft":
        errors.append("methodology_version changed")
    weights = {name: category["weight"] for name, category in scoring["categories"].items()}
    if weights != EXPECTED_WEIGHTS:
        errors.append(f"category weights changed: {weights}")
    for name in NON_MEASURED:
        if scoring["rule_results"][name]["in_denominator"] is not False:
            errors.append(f"{name} is in the denominator")
    undecided = scoring["formulas"]["category_score_when_no_measurable_rule"]
    if "DECIDE_AT_M0" not in str(undecided):
        errors.append("zero-denominator category score was decided")
    return errors


def load_scoring() -> dict:
    scoring = yaml.safe_load(SCORING_PATH.read_text(encoding="utf-8"))
    errors = scoring_errors(scoring)
    if errors:
        fail("; ".join(errors))
    return scoring


def refuse_mutated_scoring(scoring: dict) -> None:
    changed_version = copy.deepcopy(scoring)
    changed_version["methodology_version"] = "9.9.9"
    if not scoring_errors(changed_version):
        fail("a changed methodology_version was accepted")
    changed_weight = copy.deepcopy(scoring)
    changed_weight["categories"]["crawlability"]["weight"] = 21
    if not scoring_errors(changed_weight):
        fail("a changed category weight was accepted")


def stored_result(row: dict) -> str:
    if "stored_result" in row:
        return row["stored_result"]
    return row["result"]


def in_denominator(scoring: dict, row: dict) -> bool:
    return bool(scoring["rule_results"][stored_result(row)]["in_denominator"])


def category_scores(rules: list[dict], scoring: dict) -> dict[str, Decimal] | None:
    buckets = {name: [] for name in EXPECTED_WEIGHTS}
    for row in rules:
        buckets[row["category"]].append(row)
    scores = {}
    for name, rows in buckets.items():
        numerator = Decimal(0)
        denominator = Decimal(0)
        for row in rows:
            meta = scoring["rule_results"][stored_result(row)]
            if not meta["in_denominator"]:
                continue
            numerator += Decimal(str(meta["value"])) * Decimal(row["importance_weight"])
            denominator += Decimal(row["importance_weight"])
        if denominator == 0:
            return None
        scores[name] = Decimal(100) * numerator / denominator
    return scores


def readiness(scores: dict[str, Decimal], scoring: dict) -> Decimal:
    total = Decimal(0)
    for name, score in scores.items():
        weight = Decimal(scoring["categories"][name]["weight"])
        total += score * weight / Decimal(100)
    return total


def disclosure_errors(disclosure: dict) -> list[str]:
    errors = []
    if disclosure.get("score_name") != "presence_readiness":
        errors.append("score_name")
    if disclosure.get("methodology_version") != "0.1.0-draft":
        errors.append("methodology_version")
    if disclosure.get("deterministic") is not True:
        errors.append("deterministic")
    if disclosure.get("coverage") != "sample":
        errors.append("coverage")
    if "site_wide_count" not in disclosure or disclosure.get("site_wide_count") is not None:
        errors.append("site_wide_count")
    for key in FORBIDDEN:
        if key in disclosure:
            errors.append(key)
    return errors


def contains_forbidden(value) -> bool:
    if isinstance(value, dict):
        for key, item in value.items():
            if key in FORBIDDEN or contains_forbidden(item):
                return True
        return False
    if isinstance(value, list):
        return any(contains_forbidden(item) for item in value)
    return False


def false_pass_rows(rules: list[dict]) -> list[dict]:
    rows = []
    for row in rules:
        stored = row.get("stored_result")
        if stored in ("unavailable", "not_applicable") and row.get("shown_as") == "pass":
            rows.append(row)
    return rows


def require_clean_text(path: Path) -> None:
    text = path.read_text(encoding="utf-8").lower()
    for banned in BANNED_TEXT:
        if banned in text:
            fail(f"{path.name} contains {banned}")


def require_seven_passes(fixture: dict) -> None:
    rows = fixture["rules"]
    if [(row["rule_id"], row["category"]) for row in rows] != list(RULES):
        fail("rules are not the seven named passes")
    for row in rows:
        if row["importance_weight"] != 1 or row["result"] != "pass":
            fail(f"{row['rule_id']} is not importance 1 and pass")
        if "shown_as" in row:
            fail(f"{row['rule_id']} is shown as a different result")


def check_pass(scoring: dict) -> None:
    fixture = load_json(FIXTURE_DIR / "pass-seven.json")
    require_seven_passes(fixture)
    if fixture.get("applied_cap") is not None:
        fail("a critical cap is present")
    scores = category_scores(fixture["rules"], scoring)
    if scores is None:
        fail("a category denominator was zero")
    if any(score != Decimal(100) for score in scores.values()):
        fail(f"category scores are not 100: {scores}")
    if readiness(scores, scoring) != Decimal(100):
        fail("recomputed readiness is not 100")
    if disclosure_errors(fixture["disclosure"]):
        fail("valid disclosure was refused")
    if contains_forbidden(fixture):
        fail("a blended measurement is in the valid fixture")
    print("OK: recompute presence readiness 100")
    print("OK: disclosure presence_readiness 0.1.0-draft sample")


def check_full(scoring: dict) -> None:
    fixture = load_json(FIXTURE_DIR / "disclosure-full.json")
    require_seven_passes(fixture)
    if not disclosure_errors(fixture["disclosure"]):
        fail("coverage full was accepted")
    print("OK: refuse coverage full")


def check_blended(scoring: dict) -> None:
    fixture = load_json(FIXTURE_DIR / "disclosure-blended.json")
    require_seven_passes(fixture)
    if not contains_forbidden(fixture) or not disclosure_errors(fixture["disclosure"]):
        fail("a blended measurement was accepted")
    for key in ("ai_visibility", "search_performance"):
        mutated = copy.deepcopy(fixture)
        mutated["disclosure"].pop("experience_effectiveness", None)
        mutated["disclosure"][key] = 100
        if not contains_forbidden(mutated) or not disclosure_errors(mutated["disclosure"]):
            fail(f"{key} was accepted")
    print("OK: refuse blended measurement")


def check_false_pass(scoring: dict, filename: str, stored: str) -> None:
    fixture = load_json(FIXTURE_DIR / filename)
    rows = false_pass_rows(fixture["rules"])
    if len(rows) != 1 or stored_result(rows[0]) != stored:
        fail(f"{filename} does not present {stored} as pass")
    if in_denominator(scoring, rows[0]):
        fail(f"{stored} entered the denominator")
    if category_scores(fixture["rules"], scoring) is not None:
        fail(f"{filename} produced a category score")
    print(f"OK: refuse {stored} shown as pass")


def main() -> int:
    scoring = load_scoring()
    refuse_mutated_scoring(scoring)
    for path in sorted(FIXTURE_DIR.glob("*.json")):
        require_clean_text(path)
    check_pass(scoring)
    check_full(scoring)
    check_blended(scoring)
    check_false_pass(scoring, "unavailable-as-pass.json", "unavailable")
    check_false_pass(scoring, "not-applicable-as-pass.json", "not_applicable")
    print("OK: methodology_version and weights unchanged")
    print("product spend 0.00 USD")
    return 0


if __name__ == "__main__":
    sys.exit(main())
