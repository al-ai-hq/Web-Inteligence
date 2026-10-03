#!/usr/bin/env python3
"""Refuse a write with no approval, and refuse publication of a draft.

A write needs the synthetic approval. A draft stays DRAFT and is not published.
An edit approval is not publication permission.

No network, no CMS write, no client pull request, no staging run.
Product spend is 0.00 USD. Standard library only.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIXTURE_DIR = ROOT / "evals" / "m9"

GOLDEN_APPROVAL = "synthetic_approval"
DRAFT = "DRAFT"
WRITE_FIELDS = {"approvals"}
DRAFT_FIELDS = {"status"}


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    raise SystemExit(1)


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def classify_write(approvals) -> dict | None:
    """A passing write has one synthetic approval. Missing and empty are not that state."""
    if approvals == [GOLDEN_APPROVAL]:
        return {"approvals": [GOLDEN_APPROVAL]}
    return None


def write_errors(stored: dict) -> list[str]:
    if not isinstance(stored, dict):
        return ["write"]
    errors = []
    if "connector" in stored:
        errors.append("connector")
    if "pull_request" in stored:
        errors.append("pull_request")
    if set(stored) != WRITE_FIELDS:
        errors.append("fields")
    if "approvals" not in stored:
        errors.append("missing")
    elif stored.get("approvals") == []:
        errors.append("empty")
    classified = classify_write(stored.get("approvals"))
    if classified is None or stored != classified:
        errors.append("classified")
    return errors


def classify_draft(status) -> dict | None:
    """A passing change is DRAFT and is not published."""
    if status == DRAFT:
        return {"status": DRAFT}
    return None


def draft_errors(stored: dict) -> list[str]:
    if not isinstance(stored, dict):
        return ["draft"]
    errors = []
    if "connector" in stored:
        errors.append("connector")
    if "pull_request" in stored:
        errors.append("pull_request")
    if stored.get("published") is True:
        errors.append("published")
    if set(stored) != DRAFT_FIELDS:
        errors.append("fields")
    classified = classify_draft(stored.get("status"))
    if classified is None or stored != classified:
        errors.append("classified")
    return errors


def check_write() -> None:
    fixture = load_json(FIXTURE_DIR / "approved-write.json")
    if not isinstance(fixture, dict):
        fail("write fixture is not an object")
    expected = classify_write([GOLDEN_APPROVAL])
    if expected is None or fixture != expected:
        fail(f"approved write failed: {write_errors(fixture)}")
    if write_errors(fixture):
        fail(f"approved write failed: {write_errors(fixture)}")
    missing = {}
    if "missing" not in write_errors(missing):
        fail("a missing approval was accepted")
    empty = {"approvals": []}
    if "empty" not in write_errors(empty):
        fail("an empty approval list was accepted")
    other = {"approvals": ["other"]}
    if write_errors(other) == []:
        fail("a different approval was accepted")
    named = {"approvals": [GOLDEN_APPROVAL], "connector": "undecided"}
    if "connector" not in write_errors(named):
        fail("a connector field was accepted")
    print("OK: write approval is synthetic_approval")
    print("OK: missing approval is refused")
    print("OK: empty approval list is refused")


def check_draft() -> None:
    fixture = load_json(FIXTURE_DIR / "draft-change.json")
    if not isinstance(fixture, dict):
        fail("draft fixture is not an object")
    expected = classify_draft(DRAFT)
    if expected is None or fixture != expected:
        fail(f"draft change failed: {draft_errors(fixture)}")
    if draft_errors(fixture):
        fail(f"draft change failed: {draft_errors(fixture)}")
    if fixture.get("published") is True:
        fail("the passing draft was stored as published")
    published = {"status": DRAFT, "published": True}
    if "published" not in draft_errors(published):
        fail("a draft stored as published was accepted")
    with_edit = {
        "status": DRAFT,
        "approvals": [GOLDEN_APPROVAL],
        "published": True,
    }
    if "published" not in draft_errors(with_edit):
        fail("an edit approval was treated as publication permission")
    if classify_draft(DRAFT) == with_edit:
        fail("an edit approval classified the draft as published")
    with_pr = {"status": DRAFT, "pull_request": "client-pr"}
    if "pull_request" not in draft_errors(with_pr):
        fail("a pull_request field was accepted")
    print("OK: change status is DRAFT")
    print("OK: published draft is refused")
    print("OK: edit approval is not publication permission")
    print("OK: pull_request field is refused")


def main() -> int:
    check_write()
    check_draft()
    print("product spend 0.00 USD")
    return 0


if __name__ == "__main__":
    sys.exit(main())
