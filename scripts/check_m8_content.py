#!/usr/bin/env python3
"""Refuse an unsourced claim, a new page with no cannibalization result, and a published page.

A claim needs the synthetic source. A missing cannibalization result stays null
and is not stored as pass. A page stays unpublished.

No network, no CMS draft, no client pull request, no automatic publishing.
Product spend is 0.00 USD. Standard library only.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIXTURE_DIR = ROOT / "evals" / "m8"

GOLDEN_SOURCE = "synthetic_source"
NEW_PAGE = "new_page"
CHECKED = "checked"
PASS = "pass"
UNPUBLISHED = "unpublished"
PUBLISHED = "published"
DRAFT = "draft"
CLAIM_FIELDS = {"source"}
PAGE_FIELDS = {"kind", "cannibalization_result"}
STATUS_FIELDS = {"status"}


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    raise SystemExit(1)


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def classify_claim(source) -> dict | None:
    """A passing claim has the synthetic source. Missing and empty are not that state."""
    if source == GOLDEN_SOURCE:
        return {"source": GOLDEN_SOURCE}
    return None


def claim_errors(stored: dict) -> list[str]:
    if not isinstance(stored, dict):
        return ["claim"]
    errors = []
    if "pull_request" in stored:
        errors.append("pull_request")
    if set(stored) != CLAIM_FIELDS:
        errors.append("fields")
    if "source" not in stored or stored.get("source") is None:
        errors.append("source")
    elif not isinstance(stored.get("source"), str) or stored.get("source").strip() == "":
        errors.append("empty")
    classified = classify_claim(stored.get("source"))
    if classified is None or stored != classified:
        errors.append("classified")
    return errors


def classify_page(kind, result) -> dict | None:
    """A new page passes only when the cannibalization result is checked."""
    if kind == NEW_PAGE and result == CHECKED:
        return {"kind": NEW_PAGE, "cannibalization_result": CHECKED}
    return None


def classify_missing(result) -> dict | None:
    """A missing cannibalization result is null. Pass is not that state."""
    if result is None:
        return {"cannibalization_result": None}
    return None


def page_errors(stored: dict) -> list[str]:
    if not isinstance(stored, dict):
        return ["page"]
    errors = []
    if "pull_request" in stored:
        errors.append("pull_request")
    if set(stored) != PAGE_FIELDS:
        errors.append("fields")
    if "cannibalization_result" not in stored or stored.get("cannibalization_result") is None:
        errors.append("missing")
    if stored.get("cannibalization_result") == PASS:
        errors.append("pass")
    classified = classify_page(stored.get("kind"), stored.get("cannibalization_result"))
    if classified is None or stored != classified:
        errors.append("classified")
    return errors


def classify_status(status) -> dict | None:
    """A passing page is unpublished. Published and draft are not that state."""
    if status == UNPUBLISHED:
        return {"status": UNPUBLISHED}
    return None


def status_errors(stored: dict) -> list[str]:
    if not isinstance(stored, dict):
        return ["status"]
    errors = []
    if "pull_request" in stored:
        errors.append("pull_request")
    if set(stored) != STATUS_FIELDS:
        errors.append("fields")
    status = stored.get("status")
    if status == PUBLISHED:
        errors.append("published")
    if status == DRAFT:
        errors.append("draft")
    classified = classify_status(status)
    if classified is None or stored != classified:
        errors.append("classified")
    return errors


def check_claim() -> None:
    fixture = load_json(FIXTURE_DIR / "sourced-claim.json")
    if not isinstance(fixture, dict):
        fail("claim fixture is not an object")
    expected = classify_claim(GOLDEN_SOURCE)
    if expected is None or fixture != expected:
        fail(f"sourced claim failed: {claim_errors(fixture)}")
    if claim_errors(fixture):
        fail(f"sourced claim failed: {claim_errors(fixture)}")
    missing_field = {}
    if "source" not in claim_errors(missing_field):
        fail("a missing source was accepted")
    missing_null = {"source": None}
    if "source" not in claim_errors(missing_null):
        fail("a null source was accepted")
    empty = {"source": ""}
    if "empty" not in claim_errors(empty):
        fail("an empty source was accepted")
    blank = {"source": "   "}
    if "empty" not in claim_errors(blank):
        fail("a whitespace source was accepted")
    print("OK: claim source is synthetic_source")
    print("OK: missing source is refused")
    print("OK: empty source is refused")


def check_page() -> None:
    fixture = load_json(FIXTURE_DIR / "checked-page.json")
    if not isinstance(fixture, dict):
        fail("page fixture is not an object")
    expected = classify_page(NEW_PAGE, CHECKED)
    if expected is None or fixture != expected:
        fail(f"checked page failed: {page_errors(fixture)}")
    if page_errors(fixture):
        fail(f"checked page failed: {page_errors(fixture)}")
    missing = classify_missing(None)
    if missing != {"cannibalization_result": None}:
        fail("a missing cannibalization result was not classified as null")
    if missing.get("cannibalization_result") == PASS:
        fail("a missing cannibalization result was stored as pass")
    if classify_missing(PASS) is not None:
        fail("pass was classified as a missing cannibalization result")
    missing_page = {"kind": NEW_PAGE, "cannibalization_result": None}
    if "missing" not in page_errors(missing_page):
        fail("a new page with a missing cannibalization result was accepted")
    stored_pass = {"kind": NEW_PAGE, "cannibalization_result": PASS}
    if "pass" not in page_errors(stored_pass):
        fail("a missing cannibalization result stored as pass was accepted")
    print("OK: new page cannibalization result is checked")
    print("OK: missing cannibalization result is null")
    print("OK: missing cannibalization result is not stored as pass")


def check_status() -> None:
    fixture = load_json(FIXTURE_DIR / "unpublished-page.json")
    if not isinstance(fixture, dict):
        fail("status fixture is not an object")
    expected = classify_status(UNPUBLISHED)
    if expected is None or fixture != expected:
        fail(f"unpublished page failed: {status_errors(fixture)}")
    if status_errors(fixture):
        fail(f"unpublished page failed: {status_errors(fixture)}")
    published = {"status": PUBLISHED}
    if "published" not in status_errors(published):
        fail("a page stored as published was accepted")
    draft = {"status": DRAFT}
    if "draft" not in status_errors(draft):
        fail("a draft status was accepted")
    with_pr = {"status": UNPUBLISHED, "pull_request": "client-pr"}
    if "pull_request" not in status_errors(with_pr):
        fail("a pull_request field was accepted")
    print("OK: page status is unpublished")
    print("OK: published page is refused")
    print("OK: draft status is refused")
    print("OK: pull_request field is refused")


def main() -> int:
    check_claim()
    check_page()
    check_status()
    print("product spend 0.00 USD")
    return 0


if __name__ == "__main__":
    sys.exit(main())
