#!/usr/bin/env python3
"""Deny anonymous report exports and require a private noindex label.

No network, no provider call, no client-site fetch. Product spend is 0.00 USD.
Does not import scripts/check_m0b_proofs.py. Standard library only.
"""

from __future__ import annotations

import copy
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIXTURE_DIR = ROOT / "evals" / "m3"

EXPORT_FORMATS = (
    "pdf",
    "document",
    "csv",
    "json",
    "evidence_bundle",
    "task_export",
    "full_report_copy",
)
WEB_INTERACTIVE = "web_interactive"


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    raise SystemExit(1)


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def is_export(fmt: str) -> bool:
    return fmt in EXPORT_FORMATS


def export_decision(request: dict) -> dict:
    fmt = request.get("format")
    if fmt == WEB_INTERACTIVE or not is_export(fmt):
        return {
            "decision": "refused",
            "denial_reason": "not_an_export",
            "artifact": None,
            "signed_url": None,
        }
    if request.get("access_class") == "anonymous":
        return {
            "decision": "denied",
            "denial_reason": "anonymous_export_prohibited",
            "artifact": None,
            "signed_url": None,
        }
    return {
        "decision": "undecided",
        "denial_reason": None,
        "artifact": None,
        "signed_url": None,
    }


def denial_errors(row: dict) -> list[str]:
    decided = export_decision({"format": row.get("format"), "access_class": row.get("access_class")})
    errors = []
    if decided["denial_reason"] == "not_an_export":
        errors.append("not_an_export")
    if row.get("decision") != decided["decision"]:
        errors.append("decision")
    if row.get("denial_reason") != decided["denial_reason"]:
        errors.append("denial_reason")
    if row.get("artifact") != decided["artifact"]:
        errors.append("artifact")
    if row.get("signed_url") != decided["signed_url"]:
        errors.append("signed_url")
    return errors


def access_errors(access: dict) -> list[str]:
    errors = []
    if access.get("public_gallery") is not False:
        errors.append("public_gallery")
    if access.get("noindex") is not True:
        errors.append("noindex")
    return errors


def check_denials() -> None:
    fixture = load_json(FIXTURE_DIR / "deny-anonymous.json")
    rows = fixture["requests"]
    formats = [row["format"] for row in rows]
    if formats != list(EXPORT_FORMATS):
        fail(f"export formats are {formats}")
    if WEB_INTERACTIVE in formats:
        fail("web_interactive was treated as an export")
    for row in rows:
        errors = denial_errors(row)
        if errors:
            fail(f"{row['format']} denial failed: {errors}")
    sample = copy.deepcopy(rows[0])
    sample["decision"] = "authorized"
    if "decision" not in denial_errors(sample):
        fail("an authorized anonymous export was accepted")
    with_artifact = copy.deepcopy(rows[0])
    with_artifact["artifact"] = "object"
    if "artifact" not in denial_errors(with_artifact):
        fail("an artifact was accepted")
    with_url = copy.deepcopy(rows[0])
    with_url["signed_url"] = "https://example.invalid/export"
    if "signed_url" not in denial_errors(with_url):
        fail("a signed URL was accepted")
    web = copy.deepcopy(rows[0])
    web["format"] = WEB_INTERACTIVE
    if "not_an_export" not in denial_errors(web):
        fail("web_interactive was treated as an export denial")
    print("OK: deny anonymous exports")
    print("OK: web_interactive is not an export")


def check_access() -> None:
    access = load_json(FIXTURE_DIR / "access-private.json")
    if access_errors(access):
        fail("private noindex access was refused")
    public = copy.deepcopy(access)
    public["public_gallery"] = True
    if "public_gallery" not in access_errors(public):
        fail("public_gallery true was accepted")
    indexed = copy.deepcopy(access)
    indexed["noindex"] = False
    if "noindex" not in access_errors(indexed):
        fail("noindex false was accepted")
    print("OK: access public_gallery false noindex true")


def main() -> int:
    check_denials()
    check_access()
    print("product spend 0.00 USD")
    return 0


if __name__ == "__main__":
    sys.exit(main())
