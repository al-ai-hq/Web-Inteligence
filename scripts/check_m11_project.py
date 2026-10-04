#!/usr/bin/env python3
"""Keep a read inside the caller's project.

The caller is project_a. A record whose project_id is project_a may be read.
A record whose project_id is project_b is refused. A row that contains
organization_id is refused.

project_a and project_b are synthetic labels. No invitation, no live
workspace, no bulk schedule, no network.
Product spend is 0.00 USD. Standard library only.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIXTURE_DIR = ROOT / "evals" / "m11"

CALLER = "project_a"
OTHER = "project_b"
READ_FIELDS = {"caller", "project_id"}


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    raise SystemExit(1)


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def classify_read(caller, project_id) -> dict | None:
    """Keep the read only when the record's project equals the caller."""
    if caller == CALLER and project_id == caller:
        return {"caller": CALLER, "project_id": CALLER}
    return None


def read_errors(stored: dict) -> list[str]:
    if not isinstance(stored, dict):
        return ["read"]
    errors = []
    if "organization_id" in stored:
        errors.append("organization_id")
    if set(stored) != READ_FIELDS:
        errors.append("fields")
    if stored.get("caller") == CALLER and stored.get("project_id") == OTHER:
        errors.append("other")
    classified = classify_read(stored.get("caller"), stored.get("project_id"))
    if classified is None or stored != classified:
        errors.append("classified")
    return errors


def check_read() -> None:
    fixture = load_json(FIXTURE_DIR / "project-a-read.json")
    if not isinstance(fixture, dict):
        fail("read fixture is not an object")
    expected = classify_read(CALLER, CALLER)
    if expected is None or fixture != expected:
        fail(f"project A read failed: {read_errors(fixture)}")
    if read_errors(fixture):
        fail(f"project A read failed: {read_errors(fixture)}")
    other = {"caller": CALLER, "project_id": OTHER}
    if "other" not in read_errors(other):
        fail("a read of project_b was accepted")
    if classify_read(CALLER, OTHER) is not None:
        fail("project_b classified as a kept read")
    with_org = {
        "caller": CALLER,
        "project_id": CALLER,
        "organization_id": "synthetic_org",
    }
    if "organization_id" not in read_errors(with_org):
        fail("a row that contains organization_id was accepted")
    print("OK: project A record may be read")
    print("OK: project B record is refused")
    print("OK: organization_id is refused")


def main() -> int:
    check_read()
    print("product spend 0.00 USD")
    return 0


if __name__ == "__main__":
    sys.exit(main())
