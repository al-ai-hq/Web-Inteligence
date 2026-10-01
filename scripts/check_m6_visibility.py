#!/usr/bin/env python3
"""Keep observed AI visibility apart from the other scores.

Eight prompts across five slots, with two slots failed, use a denominator of
24. That denominator is prompt_count times the count of slots that are not
failed. A failed slot is not 0% and not 0. When every slot fails, the rate is
unavailable.

No network, no provider call, no client-site fetch. Product spend is 0.00 USD.
Standard library only.
"""

from __future__ import annotations

import copy
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIXTURE_DIR = ROOT / "evals" / "m6"

VISIBILITY = "observed_ai_visibility"
READINESS = "presence_readiness"
EXPERIENCE = "experience_effectiveness"
SEARCH_PERFORMANCE = "search_performance"
SCORE_FIELDS = {VISIBILITY, READINESS, EXPERIENCE}
GOLDEN_VISIBILITY = 24
GOLDEN_READINESS = 31
GOLDEN_EXPERIENCE = 22
SLOT_FIELDS = {"slot", "outcome"}
OUTCOMES = {"valid", "failed"}
GOLDEN_SLOTS = ("slot_1", "slot_2", "slot_3", "slot_4", "slot_5")
GOLDEN_VALID_OUTCOMES = ("valid", "valid", "valid", "failed", "failed")
COUNT_FIELDS = {
    "prompt_count",
    "provider_count",
    "failed_provider_count",
    "denominator",
}
PROMPT_COUNT = 8
UNAVAILABLE = "unavailable"
ZERO_PERCENT = "0%"


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    raise SystemExit(1)


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def separate_counts(visibility: int, readiness: int, experience: int) -> dict[str, int]:
    """Keep the three values apart. Do not add the visibility count to a score."""
    return {
        VISIBILITY: visibility,
        READINESS: readiness,
        EXPERIENCE: experience,
    }


def merged_with_readiness(visibility: int, readiness: int) -> int:
    return visibility + readiness


def merged_with_experience(visibility: int, experience: int) -> int:
    return visibility + experience


def score_errors(stored: dict, visibility: int, readiness: int, experience: int) -> list[str]:
    errors = []
    if not isinstance(stored, dict):
        return ["scores"]
    extra = set(stored) - SCORE_FIELDS
    if "model_id" in stored or "model_id" in extra:
        errors.append("model_id")
    if SEARCH_PERFORMANCE in stored:
        errors.append("search_performance")
    if extra - {"model_id", SEARCH_PERFORMANCE}:
        errors.append("fields")
    if stored.get(SEARCH_PERFORMANCE) == visibility:
        errors.append("search_performance")
    computed = separate_counts(visibility, readiness, experience)
    sums = (
        merged_with_readiness(visibility, readiness),
        merged_with_experience(visibility, experience),
    )
    if any(total in stored.values() for total in sums):
        errors.append("combined")
    if (
        stored.get(VISIBILITY) != computed[VISIBILITY]
        or stored.get(READINESS) != computed[READINESS]
        or stored.get(EXPERIENCE) != computed[EXPERIENCE]
    ):
        errors.append("scores")
    return errors


def slot_errors(slot: dict) -> list[str]:
    if not isinstance(slot, dict):
        return ["slot"]
    errors = []
    if "model_id" in slot:
        errors.append("model_id")
    if set(slot) - SLOT_FIELDS:
        errors.append("fields")
    if slot.get("outcome") not in OUTCOMES:
        errors.append("outcome")
    if slot.get("rate") == ZERO_PERCENT or slot.get("outcome") == ZERO_PERCENT:
        errors.append("percent")
    if slot.get("rate") == 0 or slot.get("outcome") == 0:
        errors.append("zero")
    return errors


def denominator_counts(prompt_count: int, providers: list) -> dict[str, int] | None:
    """Count failed slots, then multiply. Failures leave the denominator."""
    if type(prompt_count) is not int or not isinstance(providers, list):
        return None
    failed = 0
    for slot in providers:
        if not isinstance(slot, dict) or set(slot) != SLOT_FIELDS:
            return None
        outcome = slot.get("outcome")
        if outcome not in OUTCOMES:
            return None
        if outcome == "failed":
            failed += 1
    provider_count = len(providers)
    return {
        "prompt_count": prompt_count,
        "provider_count": provider_count,
        "failed_provider_count": failed,
        "denominator": prompt_count * (provider_count - failed),
    }


def included_denominator(prompt_count: int, providers: list) -> int | None:
    """The wrong total: every slot stays in, including failures."""
    if type(prompt_count) is not int or not isinstance(providers, list):
        return None
    return prompt_count * len(providers)


def count_errors(stored: dict, prompt_count: int, providers: list) -> list[str]:
    errors = []
    if not isinstance(stored, dict) or set(stored) != COUNT_FIELDS:
        return ["counts"]
    if "rate" in stored or ZERO_PERCENT in stored.values():
        errors.append("percent")
    computed = denominator_counts(prompt_count, providers)
    if computed is None or stored != computed:
        errors.append("denominator")
    included = included_denominator(prompt_count, providers)
    if (
        computed is not None
        and included is not None
        and included in stored.values()
        and stored.get("denominator") != computed["denominator"]
    ):
        errors.append("included")
    return errors


def classify_all_fail(providers: list) -> str | None:
    if not isinstance(providers, list) or not providers:
        return None
    for slot in providers:
        if not isinstance(slot, dict) or set(slot) != SLOT_FIELDS or slot.get("outcome") != "failed":
            return None
    return UNAVAILABLE


def rate_errors(rate, providers: list) -> list[str]:
    expected = classify_all_fail(providers)
    errors = []
    if expected is None or rate != expected:
        errors.append("rate")
    if rate == ZERO_PERCENT:
        errors.append("percent")
    if rate == 0:
        errors.append("zero")
    return errors


def golden_slots(providers: list, outcomes: tuple[str, ...]) -> bool:
    if not isinstance(providers, list) or len(providers) != len(GOLDEN_SLOTS):
        return False
    for slot, name, outcome in zip(providers, GOLDEN_SLOTS, outcomes):
        if not isinstance(slot, dict):
            return False
        if slot.get("slot") != name or slot.get("outcome") != outcome:
            return False
        if set(slot) != SLOT_FIELDS:
            return False
    return True


def check_separate() -> None:
    fixture = load_json(FIXTURE_DIR / "separate-visibility.json")
    if not isinstance(fixture, dict):
        fail("separate fixture is not an object")
    computed = separate_counts(GOLDEN_VISIBILITY, GOLDEN_READINESS, GOLDEN_EXPERIENCE)
    if fixture != computed:
        fail(f"separate scores failed: {score_errors(fixture, GOLDEN_VISIBILITY, GOLDEN_READINESS, GOLDEN_EXPERIENCE)}")
    with_readiness = merged_with_readiness(GOLDEN_VISIBILITY, GOLDEN_READINESS)
    with_experience = merged_with_experience(GOLDEN_VISIBILITY, GOLDEN_EXPERIENCE)
    on_visibility = copy.deepcopy(computed)
    on_visibility[VISIBILITY] = with_readiness
    if "combined" not in score_errors(on_visibility, GOLDEN_VISIBILITY, GOLDEN_READINESS, GOLDEN_EXPERIENCE):
        fail("a merged total stored on observed AI visibility was accepted")
    on_readiness = copy.deepcopy(computed)
    on_readiness[READINESS] = with_readiness
    if "combined" not in score_errors(on_readiness, GOLDEN_VISIBILITY, GOLDEN_READINESS, GOLDEN_EXPERIENCE):
        fail("a merged total stored on presence readiness was accepted")
    on_experience = copy.deepcopy(computed)
    on_experience[EXPERIENCE] = with_experience
    if "combined" not in score_errors(on_experience, GOLDEN_VISIBILITY, GOLDEN_READINESS, GOLDEN_EXPERIENCE):
        fail("a merged total stored on experience effectiveness was accepted")
    for total in (with_readiness, with_experience):
        beside = copy.deepcopy(computed)
        beside["combined"] = total
        if "combined" not in score_errors(beside, GOLDEN_VISIBILITY, GOLDEN_READINESS, GOLDEN_EXPERIENCE):
            fail("a merged total stored beside the scores was accepted")
    blended = copy.deepcopy(computed)
    blended[SEARCH_PERFORMANCE] = GOLDEN_VISIBILITY
    if "search_performance" not in score_errors(blended, GOLDEN_VISIBILITY, GOLDEN_READINESS, GOLDEN_EXPERIENCE):
        fail("the visibility count written into search performance was accepted")
    named = copy.deepcopy(computed)
    named["model_id"] = "slot_1"
    if "model_id" not in score_errors(named, GOLDEN_VISIBILITY, GOLDEN_READINESS, GOLDEN_EXPERIENCE):
        fail("a model id was accepted")
    print("OK: observed AI visibility stays apart from both scores")
    print("OK: merged totals refused")
    print("OK: visibility count is not written into search performance")


def check_denominator() -> int:
    fixture = load_json(FIXTURE_DIR / "valid-denominator.json")
    if not isinstance(fixture, dict) or not isinstance(fixture.get("providers"), list) or not isinstance(fixture.get("counts"), dict):
        fail("denominator fixture is missing providers or counts")
    prompt_count = fixture.get("prompt_count")
    providers = fixture["providers"]
    if prompt_count != PROMPT_COUNT or not golden_slots(providers, GOLDEN_VALID_OUTCOMES):
        fail("denominator fixture is not the 8 by 5 case")
    computed = denominator_counts(prompt_count, providers)
    if computed is None:
        fail("denominator could not be computed")
    if fixture["counts"] != computed:
        fail(f"stored denominator does not match the computation: {count_errors(fixture['counts'], prompt_count, providers)}")
    if computed["denominator"] != prompt_count * (computed["provider_count"] - computed["failed_provider_count"]):
        fail("denominator was not prompt_count times the valid slots")
    if computed["denominator"] != 24:
        fail("computed denominator was not 24")
    included = included_denominator(prompt_count, providers)
    folded = copy.deepcopy(computed)
    folded["denominator"] = included
    if "included" not in count_errors(folded, prompt_count, providers) and "denominator" not in count_errors(folded, prompt_count, providers):
        fail("a denominator of 40 was accepted")
    failed = copy.deepcopy(providers[3])
    failed["rate"] = ZERO_PERCENT
    if "percent" not in slot_errors(failed):
        fail("a failed slot stored as 0% was accepted")
    failed_zero = copy.deepcopy(providers[3])
    failed_zero["rate"] = 0
    if "zero" not in slot_errors(failed_zero):
        fail("a failed slot stored as 0 was accepted")
    flipped = copy.deepcopy(providers)
    flipped[3]["outcome"] = "valid"
    flipped_counts = denominator_counts(prompt_count, flipped)
    if flipped_counts != {
        "prompt_count": 8,
        "provider_count": 5,
        "failed_provider_count": 1,
        "denominator": 32,
    }:
        fail("a different failure count was not recomputed")
    if fixture["counts"] == flipped_counts:
        fail("the golden counts matched a different failure count")
    print("OK: valid denominator is 24")
    print("OK: a different failure count is recomputed")
    print("OK: failed providers are not stored as 0% or 0")
    return computed["denominator"]


def check_all_fail() -> None:
    fixture = load_json(FIXTURE_DIR / "all-failed.json")
    if not isinstance(fixture, dict) or not isinstance(fixture.get("providers"), list):
        fail("all-fail fixture is missing providers")
    providers = fixture["providers"]
    failed_outcomes = tuple("failed" for _ in GOLDEN_SLOTS)
    if fixture.get("prompt_count") != PROMPT_COUNT or not golden_slots(providers, failed_outcomes):
        fail("all-fail fixture is not five failed slots")
    expected = classify_all_fail(providers)
    if expected != UNAVAILABLE or fixture.get("rate") != expected:
        fail(f"all-fail rate failed: {rate_errors(fixture.get('rate'), providers)}")
    if "percent" not in rate_errors(ZERO_PERCENT, providers):
        fail("an all-fail rate stored as 0% was accepted")
    if "zero" not in rate_errors(0, providers):
        fail("an all-fail rate stored as 0 was accepted")
    print("OK: all-fail rate is unavailable")
    print("OK: all-fail rate is not 0% or 0")


def main() -> int:
    check_denominator()
    check_separate()
    check_all_fail()
    print("product spend 0.00 USD")
    return 0


if __name__ == "__main__":
    sys.exit(main())
