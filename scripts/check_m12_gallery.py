#!/usr/bin/env python3
"""Keep an anonymous report out of a public gallery when consent is missing.

Missing consent is an absent consent field or JSON null. Empty consent is
"" or whitespace after trimming. Both are no consent. A stored placement
of public is refused. A row that contains public_link or noindex is refused.

anonymous and public are synthetic labels. No public page, no public link,
no noindex change, no network.
Product spend is 0.00 USD. Standard library only.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIXTURE_DIR = ROOT / "evals" / "m12"

REPORT = "anonymous"
PUBLIC = "public"
KEPT_FIELDS = {"report"}
MISSING = "missing"
EMPTY = "empty"
PRESENT = "present"


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    raise SystemExit(1)


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def consent_kind(stored: dict) -> str:
    """Missing and empty are both no consent. A real value is not this case."""
    if "consent" not in stored:
        return MISSING
    value = stored["consent"]
    if value is None:
        return MISSING
    if isinstance(value, str) and value.strip() == "":
        return EMPTY
    return PRESENT


def classify_report(stored: dict) -> dict | None:
    """Keep the report only when it stays out of the gallery with no consent."""
    if not isinstance(stored, dict):
        return None
    if stored.get("report") != REPORT:
        return None
    if consent_kind(stored) not in (MISSING, EMPTY):
        return None
    if "consent" in stored:
        return None
    if "placement" in stored or "public_link" in stored or "noindex" in stored:
        return None
    if set(stored) != KEPT_FIELDS:
        return None
    return {"report": REPORT}


def gallery_errors(stored: dict) -> list[str]:
    if not isinstance(stored, dict):
        return ["report"]
    errors = []
    if "public_link" in stored:
        errors.append("public_link")
    if "noindex" in stored:
        errors.append("noindex")
    if stored.get("placement") == PUBLIC:
        errors.append("public")
    kind = consent_kind(stored)
    if kind in (MISSING, EMPTY) and stored.get("placement") == PUBLIC:
        errors.append("placed")
    classified = classify_report(stored)
    if classified is None or stored != classified:
        errors.append("classified")
    return errors


def check_gallery() -> None:
    fixture = load_json(FIXTURE_DIR / "missing-consent.json")
    if not isinstance(fixture, dict):
        fail("gallery fixture is not an object")
    if consent_kind(fixture) != MISSING:
        fail("the golden report is not missing consent")
    expected = classify_report(fixture)
    if expected is None or fixture != expected:
        fail(f"missing consent failed: {gallery_errors(fixture)}")
    if gallery_errors(fixture):
        fail(f"missing consent failed: {gallery_errors(fixture)}")
    null_consent = {"report": REPORT, "consent": None}
    if consent_kind(null_consent) != MISSING:
        fail("JSON null consent was not missing")
    empty_consent = {"report": REPORT, "consent": ""}
    if consent_kind(empty_consent) != EMPTY:
        fail("empty consent was not empty")
    blank_consent = {"report": REPORT, "consent": "   "}
    if consent_kind(blank_consent) != EMPTY:
        fail("whitespace consent was not empty")
    present = {"report": REPORT, "consent": "synthetic_consent"}
    if consent_kind(present) == PRESENT and classify_report(present) is not None:
        fail("a present consent was placed in the gallery")
    placed_rows = (
        {"report": REPORT, "placement": PUBLIC},
        {"report": REPORT, "consent": None, "placement": PUBLIC},
        {"report": REPORT, "consent": "", "placement": PUBLIC},
        {"report": REPORT, "consent": "   ", "placement": PUBLIC},
    )
    for row in placed_rows:
        if "public" not in gallery_errors(row):
            fail("a stored public placement was accepted")
        if classify_report(row) is not None:
            fail("a stored public placement classified as kept")
    with_link = {"report": REPORT, "public_link": "synthetic_link"}
    if "public_link" not in gallery_errors(with_link):
        fail("a row that contains public_link was accepted")
    with_noindex = {"report": REPORT, "noindex": "changed"}
    if "noindex" not in gallery_errors(with_noindex):
        fail("a row that contains noindex was accepted")
    print("OK: missing consent stays out of the public gallery")
    print("OK: empty consent is no consent")
    print("OK: stored public placement is refused")
    print("OK: public_link is refused")
    print("OK: noindex is refused")


def main() -> int:
    check_gallery()
    print("product spend 0.00 USD")
    return 0


if __name__ == "__main__":
    sys.exit(main())
