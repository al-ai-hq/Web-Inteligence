#!/usr/bin/env python3
"""Keep Search Console totals apart from GA4 totals.

Rows that share a source are summed. A Search Console total is never added to
a GA4 total. A missing optional source stays not_supplied. That state is not
measured_zero and it is not the number 0.

No network, no provider call, no client-site fetch. Product spend is 0.00 USD.
Standard library only.
"""

from __future__ import annotations

import copy
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIXTURE_DIR = ROOT / "evals" / "m4"

ALLOWED_SOURCES = ("search_console", "ga4")
GENERATIVE_AI_EXPORT = "search_console_generative_ai_export"
OPTIONAL_SOURCE = "ga4"
SCORE_FIELDS = (
    "presence_readiness",
    "experience_effectiveness",
    "observed_ai_visibility",
)
ROW_FIELDS = {"source", "value", "integrity_state"}


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    raise SystemExit(1)


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def shared_row_errors(row: dict) -> list[str]:
    errors = []
    if not isinstance(row, dict):
        return ["row"]
    source = row.get("source")
    if source == GENERATIVE_AI_EXPORT or "ctr" in row:
        errors.append("ctr")
    if source not in ALLOWED_SOURCES:
        errors.append("source")
    for field in SCORE_FIELDS:
        if field in row:
            errors.append(field)
    extra = set(row) - ROW_FIELDS
    if extra:
        errors.append("fields")
    return errors


def separate_totals(rows: list[dict]) -> dict[str, int]:
    """Sum values that share a source. Never add one source to another."""
    totals: dict[str, int] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        source = row.get("source")
        value = row.get("value")
        if source not in ALLOWED_SOURCES or type(value) is not int:
            continue
        totals[source] = totals.get(source, 0) + value
    return totals


def cross_source_sum(totals: dict[str, int]) -> int | None:
    if "search_console" not in totals or "ga4" not in totals:
        return None
    return totals["search_console"] + totals["ga4"]


def separate_errors(rows: list[dict], stored: dict) -> list[str]:
    errors = []
    if not isinstance(rows, list) or [row.get("source") if isinstance(row, dict) else None for row in rows] != list(ALLOWED_SOURCES):
        errors.append("order")
    for row in rows if isinstance(rows, list) else []:
        errors.extend(shared_row_errors(row))
        if isinstance(row, dict) and row.get("integrity_state") != "valid":
            errors.append("integrity_state")
        if not isinstance(row, dict) or type(row.get("value")) is not int:
            errors.append("value")
    if isinstance(rows, list) and len(rows) == 2:
        if rows[0].get("value") != 12 or rows[1].get("value") != 40:
            errors.append("scenario")
    computed = separate_totals(rows if isinstance(rows, list) else [])
    if not isinstance(stored, dict):
        errors.append("totals")
        return errors
    summed = cross_source_sum(computed)
    if summed is not None and summed in stored.values():
        errors.append("combined")
    if stored != computed:
        errors.append("totals")
    return errors


def classify_missing(row: dict) -> dict | None:
    """A null optional GA4 value is not_supplied. A number is not that state."""
    if not isinstance(row, dict):
        return None
    if row.get("source") != OPTIONAL_SOURCE:
        return None
    if set(row) - ROW_FIELDS:
        return None
    if row.get("value") is not None:
        return None
    return {
        "source": OPTIONAL_SOURCE,
        "value": None,
        "integrity_state": "not_supplied",
    }


def missing_errors(row: dict) -> list[str]:
    if not isinstance(row, dict):
        return ["row"]
    errors = shared_row_errors(row)
    if row.get("source") != OPTIONAL_SOURCE:
        errors.append("optional_source")
    classified = classify_missing(row)
    state = row.get("integrity_state")
    value = row.get("value")
    if classified is None:
        errors.append("refused")
    elif state != classified["integrity_state"] or value != classified["value"]:
        errors.append("integrity_state")
    if state == "measured_zero":
        errors.append("measured_zero")
    if value == 0:
        errors.append("zero")
    if state == "not_supplied" and type(value) is int:
        errors.append("number")
    return errors


def check_separate() -> None:
    fixture = load_json(FIXTURE_DIR / "separate-sources.json")
    if not isinstance(fixture, dict) or not isinstance(fixture.get("rows"), list) or not isinstance(fixture.get("totals"), dict):
        fail("separate fixture is missing rows or totals")
    rows = fixture["rows"]
    errors = separate_errors(rows, fixture["totals"])
    if errors:
        fail(f"separate totals failed: {errors}")
    computed = separate_totals(rows)
    folded = {
        "search_console": cross_source_sum(computed),
        "ga4": computed["ga4"],
    }
    if "combined" not in separate_errors(rows, folded):
        fail("a combined total was accepted")
    same_source = [
        {"source": "search_console", "value": 5, "integrity_state": "valid"},
        {"source": "search_console", "value": 7, "integrity_state": "valid"},
        {"source": "ga4", "value": 40, "integrity_state": "valid"},
    ]
    same_totals = separate_totals(same_source)
    if same_totals != {"search_console": 12, "ga4": 40}:
        fail("same-source rows were not summed")
    if 52 in same_totals.values():
        fail("same-source sums were added across sources")
    folded_row = copy.deepcopy(rows[0])
    folded_row["presence_readiness"] = folded_row["value"]
    if "presence_readiness" not in shared_row_errors(folded_row):
        fail("a Search Console number was written into presence readiness")
    experience = copy.deepcopy(rows[1])
    experience["experience_effectiveness"] = experience["value"]
    if "experience_effectiveness" not in shared_row_errors(experience):
        fail("a GA4 number was written into experience effectiveness")
    visibility = copy.deepcopy(rows[0])
    visibility["observed_ai_visibility"] = visibility["value"]
    if "observed_ai_visibility" not in shared_row_errors(visibility):
        fail("a Search Console number was written into observed AI visibility")
    third = copy.deepcopy(rows[0])
    third["source"] = "pagespeed"
    if "source" not in shared_row_errors(third):
        fail("a third source was accepted")
    generative = {
        "source": GENERATIVE_AI_EXPORT,
        "value": 1,
        "integrity_state": "valid",
        "ctr": 1,
    }
    if "ctr" not in shared_row_errors(generative):
        fail("a generative-AI export CTR was accepted")
    print("OK: separate search_console and ga4 totals")
    print("OK: combined total refused")
    print("OK: same-source rows are summed")


def check_missing() -> None:
    row = load_json(FIXTURE_DIR / "missing-source.json")
    if not isinstance(row, dict):
        fail("missing fixture is not a row")
    if missing_errors(row):
        fail(f"missing source failed: {missing_errors(row)}")
    classified = classify_missing(row)
    if classified != {"source": "ga4", "value": None, "integrity_state": "not_supplied"}:
        fail("missing source was not classified as not_supplied")
    if row.get("integrity_state") != classified["integrity_state"] or row.get("value") != classified["value"]:
        fail("stored missing row does not match the classification")
    measured = copy.deepcopy(row)
    measured["integrity_state"] = "measured_zero"
    if "measured_zero" not in missing_errors(measured):
        fail("not_supplied stored as measured_zero was accepted")
    zero = copy.deepcopy(row)
    zero["value"] = 0
    if "zero" not in missing_errors(zero):
        fail("not_supplied stored as 0 was accepted")
    numbered = copy.deepcopy(row)
    numbered["value"] = 7
    if "number" not in missing_errors(numbered):
        fail("not_supplied paired with a number was accepted")
    print("OK: missing optional source is not_supplied")
    print("OK: not_supplied is not measured_zero")
    print("OK: not_supplied is not 0")


def main() -> int:
    check_separate()
    check_missing()
    print("product spend 0.00 USD")
    return 0


if __name__ == "__main__":
    sys.exit(main())
