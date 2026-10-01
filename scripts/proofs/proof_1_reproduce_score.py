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
