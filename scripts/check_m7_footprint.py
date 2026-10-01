#!/usr/bin/env python3
"""Keep a public fact sourced, a missing review count null, and a correction unapplied.

A fact needs a synthetic source and a confidence label. A missing review count
is null, not 0 and not another number. A correction stays pending.

No network, no provider call, no client-site fetch, no connector write.
Product spend is 0.00 USD. Standard library only.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIXTURE_DIR = ROOT / "evals" / "m7"

CONFIDENCE_LABELS = {"high", "medium", "low"}
GOLDEN_SOURCE = "synthetic_source"
GOLDEN_CONFIDENCE = "medium"
FACT_FIELDS = {"source", "confidence"}
COUNT_FIELDS = {"review_count"}
CORRECTION_FIELDS = {"status"}
PENDING = "pending"
APPLIED = "applied"
FABRICATED_COUNT = 4


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    raise SystemExit(1)


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def is_url_source(source: str) -> bool:
    """Refuse a fetch target. This is not a full URL parser."""
    stripped = source.strip().lower()
    return stripped.startswith("http") or stripped.startswith("//") or "://" in stripped


def classify_fact(source, confidence) -> dict | None:
    """A visible fact has a non-empty synthetic source and a known confidence label."""
    if not isinstance(source, str) or source.strip() == "" or is_url_source(source):
        return None
    if confidence not in CONFIDENCE_LABELS:
        return None
    return {"source": source, "confidence": confidence}


def fact_errors(stored: dict) -> list[str]:
    if not isinstance(stored, dict):
        return ["fact"]
    errors = []
    if "platform_name" in stored:
        errors.append("platform_name")
    extra = set(stored) - FACT_FIELDS
    if extra:
        errors.append("fields")
    source = stored.get("source") if "source" in stored else None
    if "source" not in stored or not isinstance(source, str) or source.strip() == "":
        errors.append("source")
    elif is_url_source(source):
        errors.append("url")
    if "confidence" not in stored:
        errors.append("confidence")
    elif stored.get("confidence") not in CONFIDENCE_LABELS:
        errors.append("confidence_label")
    classified = classify_fact(stored.get("source"), stored.get("confidence"))
    if classified is None or stored != classified:
        errors.append("classified")
    return errors


def classify_missing(review_count) -> dict | None:
    """A missing count is null. A number is not that state."""
    if review_count is None:
        return {"review_count": None}
    return None


def count_errors(stored: dict) -> list[str]:
    if not isinstance(stored, dict):
        return ["count"]
    errors = []
    if "as_displayed" in stored:
        errors.append("as_displayed")
    if "platform_name" in stored:
        errors.append("platform_name")
    if set(stored) != COUNT_FIELDS:
        errors.append("fields")
    review_count = stored.get("review_count") if "review_count" in stored else False
    classified = classify_missing(review_count if "review_count" in stored else False)
    if classified is None or stored != classified:
        errors.append("classified")
    if type(review_count) is int and review_count == 0:
        errors.append("zero")
    if type(review_count) is int and review_count != 0:
        errors.append("number")
    return errors


def classify_correction(status) -> dict | None:
    """An unapplied correction is pending. Applied is not that state."""
    if status == PENDING:
        return {"status": PENDING}
    return None


def correction_errors(stored: dict) -> list[str]:
    if not isinstance(stored, dict):
        return ["correction"]
    errors = []
    if "platform_name" in stored:
        errors.append("platform_name")
    if set(stored) != CORRECTION_FIELDS:
        errors.append("fields")
    status = stored.get("status")
    if status == APPLIED:
        errors.append("applied")
    classified = classify_correction(status)
    if classified is None or stored != classified:
        errors.append("classified")
    return errors


def check_fact() -> None:
    fixture = load_json(FIXTURE_DIR / "sourced-fact.json")
    if not isinstance(fixture, dict):
        fail("fact fixture is not an object")
    expected = classify_fact(GOLDEN_SOURCE, GOLDEN_CONFIDENCE)
    if expected is None or fixture != expected:
        fail(f"sourced fact failed: {fact_errors(fixture)}")
    if fact_errors(fixture):
        fail(f"sourced fact failed: {fact_errors(fixture)}")
    for label in ("high", "low"):
        labelled = {"source": GOLDEN_SOURCE, "confidence": label}
        if fact_errors(labelled):
            fail(f"confidence label {label} was refused")
    missing_source = {"confidence": GOLDEN_CONFIDENCE}
    if "source" not in fact_errors(missing_source):
        fail("a missing source was accepted")
    empty_source = {"source": "", "confidence": GOLDEN_CONFIDENCE}
    if "source" not in fact_errors(empty_source):
        fail("an empty source was accepted")
    missing_confidence = {"source": GOLDEN_SOURCE}
    if "confidence" not in fact_errors(missing_confidence):
        fail("a missing confidence label was accepted")
    unknown = {"source": GOLDEN_SOURCE, "confidence": "certain"}
    if "confidence_label" not in fact_errors(unknown):
        fail("a confidence label outside the allowed set was accepted")
    url_source = {"source": "https://example.invalid/profile", "confidence": GOLDEN_CONFIDENCE}
    if "url" not in fact_errors(url_source):
        fail("a URL source was accepted")
    upper_scheme = {"source": "HTTPS://example.invalid/profile", "confidence": GOLDEN_CONFIDENCE}
    if "url" not in fact_errors(upper_scheme):
        fail("an uppercase URL source was accepted")
    spaced_url = {"source": " https://example.invalid/profile", "confidence": GOLDEN_CONFIDENCE}
    if "url" not in fact_errors(spaced_url):
        fail("a spaced URL source was accepted")
    scheme_relative = {"source": "//example.invalid/profile", "confidence": GOLDEN_CONFIDENCE}
    if "url" not in fact_errors(scheme_relative):
        fail("a scheme-relative URL source was accepted")
    named = {"source": GOLDEN_SOURCE, "confidence": GOLDEN_CONFIDENCE, "platform_name": "synthetic_source"}
    if "platform_name" not in fact_errors(named):
        fail("a platform name was accepted")
    print("OK: public fact shows a source and a confidence label")
    print("OK: missing source is refused")
    print("OK: missing confidence label is refused")


def check_count() -> None:
    fixture = load_json(FIXTURE_DIR / "missing-review-count.json")
    if not isinstance(fixture, dict):
        fail("count fixture is not an object")
    expected = classify_missing(None)
    if expected is None or fixture != expected:
        fail(f"missing review count failed: {count_errors(fixture)}")
    if count_errors(fixture):
        fail(f"missing review count failed: {count_errors(fixture)}")
    zero = {"review_count": 0}
    if "zero" not in count_errors(zero):
        fail("a missing review count stored as 0 was accepted")
    numbered = {"review_count": FABRICATED_COUNT}
    if "number" not in count_errors(numbered):
        fail("a missing review count stored as another number was accepted")
    displayed = {"review_count": None, "as_displayed": True}
    if "as_displayed" not in count_errors(displayed):
        fail("a displayed count was accepted in the missing-count case")
    print("OK: missing review count is null")
    print("OK: missing review count is not 0")
    print("OK: missing review count is not another number")


def check_correction() -> None:
    fixture = load_json(FIXTURE_DIR / "unapplied-correction.json")
    if not isinstance(fixture, dict):
        fail("correction fixture is not an object")
    expected = classify_correction(PENDING)
    if expected is None or fixture != expected:
        fail(f"unapplied correction failed: {correction_errors(fixture)}")
    if correction_errors(fixture):
        fail(f"unapplied correction failed: {correction_errors(fixture)}")
    applied = {"status": APPLIED}
    if "applied" not in correction_errors(applied):
        fail("a correction stored as applied was accepted")
    print("OK: correction stays pending")
    print("OK: applied correction is refused")


def main() -> int:
    check_fact()
    check_count()
    check_correction()
    print("product spend 0.00 USD")
    return 0


if __name__ == "__main__":
    sys.exit(main())
