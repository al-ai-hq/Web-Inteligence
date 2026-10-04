#!/usr/bin/env python3
"""Refuse a schedule that adds a write or a new target, and keep an unchanged run quiet.

A bounded schedule has both flags false. An unchanged run stores no alert.
A raised alert on that run is refused.

No scheduler, no crawl, no deletion, no network.
Product spend is 0.00 USD. Standard library only.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIXTURE_DIR = ROOT / "evals" / "m10"

UNCHANGED = "unchanged"
RAISED = "raised"
SCHEDULE_FIELDS = {"adds_write", "adds_target"}
RUN_FIELDS = {"state"}


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    raise SystemExit(1)


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def classify_schedule(adds_write, adds_target) -> dict | None:
    """A passing schedule adds neither a write nor a new target."""
    if adds_write is False and adds_target is False:
        return {"adds_write": False, "adds_target": False}
    return None


def schedule_errors(stored: dict) -> list[str]:
    if not isinstance(stored, dict):
        return ["schedule"]
    errors = []
    if set(stored) != SCHEDULE_FIELDS:
        errors.append("fields")
    if stored.get("adds_write") is True:
        errors.append("write")
    if stored.get("adds_target") is True:
        errors.append("target")
    classified = classify_schedule(stored.get("adds_write"), stored.get("adds_target"))
    if classified is None or stored != classified:
        errors.append("classified")
    return errors


def classify_run(state, alert_present: bool) -> dict | None:
    """A quiet run is unchanged and stores no alert."""
    if state == UNCHANGED and not alert_present:
        return {"state": UNCHANGED}
    return None


def run_errors(stored: dict) -> list[str]:
    if not isinstance(stored, dict):
        return ["run"]
    errors = []
    if "alert" in stored:
        errors.append("alert")
    if stored.get("alert") == RAISED:
        errors.append("raised")
    if set(stored) != RUN_FIELDS:
        errors.append("fields")
    classified = classify_run(stored.get("state"), "alert" in stored)
    if classified is None or stored != classified:
        errors.append("classified")
    return errors


def check_schedule() -> None:
    fixture = load_json(FIXTURE_DIR / "bounded-schedule.json")
    if not isinstance(fixture, dict):
        fail("schedule fixture is not an object")
    expected = classify_schedule(False, False)
    if expected is None or fixture != expected:
        fail(f"bounded schedule failed: {schedule_errors(fixture)}")
    if schedule_errors(fixture):
        fail(f"bounded schedule failed: {schedule_errors(fixture)}")
    adds_write = {"adds_write": True, "adds_target": False}
    if "write" not in schedule_errors(adds_write):
        fail("a schedule which adds a write was accepted")
    adds_target = {"adds_write": False, "adds_target": True}
    if "target" not in schedule_errors(adds_target):
        fail("a schedule which adds a new target was accepted")
    print("OK: schedule does not add a write or a new target")
    print("OK: schedule which adds a write is refused")
    print("OK: schedule which adds a new target is refused")


def check_run() -> None:
    fixture = load_json(FIXTURE_DIR / "unchanged-run.json")
    if not isinstance(fixture, dict):
        fail("run fixture is not an object")
    expected = classify_run(UNCHANGED, False)
    if expected is None or fixture != expected:
        fail(f"unchanged run failed: {run_errors(fixture)}")
    if run_errors(fixture):
        fail(f"unchanged run failed: {run_errors(fixture)}")
    if "alert" in fixture:
        fail("the quiet run stored an alert")
    raised = {"state": UNCHANGED, "alert": RAISED}
    if "raised" not in run_errors(raised):
        fail("a raised alert on an unchanged run was accepted")
    print("OK: unchanged run does not raise an alert")
    print("OK: raised alert on an unchanged run is refused")


def main() -> int:
    check_schedule()
    check_run()
    print("product spend 0.00 USD")
    return 0


if __name__ == "__main__":
    sys.exit(main())
