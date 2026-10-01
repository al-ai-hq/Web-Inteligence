#!/usr/bin/env python3
"""Keep Experience Effectiveness apart from Presence Readiness.

A subjective rubric result stays assessed and inferred. A deterministic
finding stays observed or computed, and verified. The two scores are never
added together, and neither is written into observed AI visibility or search
performance.

No network, no provider call, no client-site fetch, no form submission.
Product spend is 0.00 USD. Standard library only.
"""

from __future__ import annotations

import copy
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIXTURE_DIR = ROOT / "evals" / "m5"

EXPERIENCE = "experience_effectiveness"
READINESS = "presence_readiness"
SCORE_FIELDS = {EXPERIENCE, READINESS}
BLEND_FIELDS = ("observed_ai_visibility", "search_performance")
WEIGHT_FIELDS = (
    "weight",
    "criterion_weight",
    "dimension_weight",
    "methodology_version",
)
GOLDEN_EXPERIENCE = 18
GOLDEN_READINESS = 64
LABEL_FIELDS = {"fidelity_label", "evidence_state"}
EVIDENCE_FOR_FIDELITY = {
    "assessed": "inferred",
    "observed": "verified",
    "computed": "verified",
}
KINDS = ("subjective", "deterministic_observed", "deterministic_computed")


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    raise SystemExit(1)


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def separate_scores(experience_effectiveness: int, presence_readiness: int) -> dict[str, int]:
    """Return the two scores as separate values. Do not add them."""
    return {
        EXPERIENCE: experience_effectiveness,
        READINESS: presence_readiness,
    }


def merged_total(experience_effectiveness: int, presence_readiness: int) -> int:
    return experience_effectiveness + presence_readiness


def score_errors(stored: dict, experience_effectiveness: int, presence_readiness: int) -> list[str]:
    errors = []
    if not isinstance(stored, dict):
        return ["scores"]
    extra = set(stored) - SCORE_FIELDS
    if extra & set(WEIGHT_FIELDS):
        errors.append("weight")
    if extra & set(BLEND_FIELDS):
        errors.append("blended")
    if extra - set(WEIGHT_FIELDS) - set(BLEND_FIELDS):
        errors.append("fields")
    for field in BLEND_FIELDS:
        if stored.get(field) in (experience_effectiveness, presence_readiness):
            errors.append("blended")
    computed = separate_scores(experience_effectiveness, presence_readiness)
    merged = merged_total(experience_effectiveness, presence_readiness)
    if merged in stored.values():
        errors.append("combined")
    if stored.get(EXPERIENCE) != computed[EXPERIENCE] or stored.get(READINESS) != computed[READINESS]:
        errors.append("scores")
    return errors


def evidence_for(fidelity_label: str) -> str | None:
    """Map a fidelity label to its user-facing evidence state."""
    return EVIDENCE_FOR_FIDELITY.get(fidelity_label)


def classify_result(kind: str) -> dict | None:
    if kind == "subjective":
        label = "assessed"
    elif kind == "deterministic_observed":
        label = "observed"
    elif kind == "deterministic_computed":
        label = "computed"
    else:
        return None
    state = evidence_for(label)
    if state is None:
        return None
    return {"fidelity_label": label, "evidence_state": state}


def label_errors(row: dict, kind: str) -> list[str]:
    if not isinstance(row, dict) or set(row) != LABEL_FIELDS:
        return ["fields"]
    expected = classify_result(kind)
    if expected is None:
        return ["kind"]
    errors = []
    if row.get("fidelity_label") != expected["fidelity_label"]:
        errors.append("fidelity_label")
        if kind == "subjective" and row.get("fidelity_label") == "observed":
            errors.append("observed")
        if kind == "subjective" and row.get("fidelity_label") == "computed":
            errors.append("computed")
    if row.get("evidence_state") != expected["evidence_state"]:
        errors.append("evidence_state")
        if kind == "subjective" and row.get("evidence_state") == "verified":
            errors.append("verified")
    return errors


def check_separate() -> None:
    fixture = load_json(FIXTURE_DIR / "separate-scores.json")
    if not isinstance(fixture, dict):
        fail("separate fixture is not an object")
    computed = separate_scores(GOLDEN_EXPERIENCE, GOLDEN_READINESS)
    merged = merged_total(GOLDEN_EXPERIENCE, GOLDEN_READINESS)
    if fixture != computed:
        fail(f"separate scores failed: {score_errors(fixture, GOLDEN_EXPERIENCE, GOLDEN_READINESS)}")
    if merged in fixture.values():
        fail("a merged total was stored")
    on_experience = {
        EXPERIENCE: merged,
        READINESS: GOLDEN_READINESS,
    }
    if "combined" not in score_errors(on_experience, GOLDEN_EXPERIENCE, GOLDEN_READINESS):
        fail("a merged total stored on experience effectiveness was accepted")
    on_readiness = {
        EXPERIENCE: GOLDEN_EXPERIENCE,
        READINESS: merged,
    }
    if "combined" not in score_errors(on_readiness, GOLDEN_EXPERIENCE, GOLDEN_READINESS):
        fail("a merged total stored on presence readiness was accepted")
    beside = copy.deepcopy(computed)
    beside["combined"] = merged
    if "combined" not in score_errors(beside, GOLDEN_EXPERIENCE, GOLDEN_READINESS):
        fail("a merged total stored beside the scores was accepted")
    for field in BLEND_FIELDS:
        for value in (GOLDEN_EXPERIENCE, GOLDEN_READINESS):
            blended = copy.deepcopy(computed)
            blended[field] = value
            if "blended" not in score_errors(blended, GOLDEN_EXPERIENCE, GOLDEN_READINESS):
                fail(f"a score written into {field} was accepted")
    weighted = copy.deepcopy(computed)
    weighted["criterion_weight"] = 1
    if "weight" not in score_errors(weighted, GOLDEN_EXPERIENCE, GOLDEN_READINESS):
        fail("a weight field was accepted")
    print("OK: experience effectiveness and presence readiness stay apart")
    print("OK: merged total refused")
    print("OK: neither score is written into observed AI visibility or search performance")
    print("OK: a weight field is refused")


def check_labels() -> None:
    fixture = load_json(FIXTURE_DIR / "result-labels.json")
    if not isinstance(fixture, dict) or not isinstance(fixture.get("rows"), list):
        fail("label fixture is missing rows")
    expected = [classify_result(kind) for kind in KINDS]
    if fixture["rows"] != expected:
        fail("stored labels do not match the classification")
    for row, kind in zip(fixture["rows"], KINDS):
        if label_errors(row, kind):
            fail(f"label row failed: {label_errors(row, kind)}")
    as_observed = {"fidelity_label": "observed", "evidence_state": "inferred"}
    if "observed" not in label_errors(as_observed, "subjective"):
        fail("assessed stored as observed was accepted")
    as_computed = {"fidelity_label": "computed", "evidence_state": "inferred"}
    if "computed" not in label_errors(as_computed, "subjective"):
        fail("assessed stored as computed was accepted")
    as_verified = {"fidelity_label": "assessed", "evidence_state": "verified"}
    if "verified" not in label_errors(as_verified, "subjective"):
        fail("inferred stored as verified was accepted")
    print("OK: subjective result is assessed and inferred")
    print("OK: deterministic finding is observed or computed, and verified")
    print("OK: assessed stored as observed or computed is refused")
    print("OK: inferred stored as verified is refused")


def main() -> int:
    check_separate()
    check_labels()
    print("product spend 0.00 USD")
    return 0


if __name__ == "__main__":
    sys.exit(main())
