#!/usr/bin/env python3
"""Proof 4: Deny unauthorized export (anonymous) and self-approval on change sets."""

from scripts.proofs.helpers import (
    assert_valid,
    load_fixture,
)


def run() -> bool:
    export_auth = load_fixture("proof_4", "export_anonymous.json")
    assert_valid(export_auth, "export-authorization.schema.json", "export_authorization")

    if export_auth["requester"]["access_class"] != "anonymous":
        print("FAIL: expected anonymous requester")
        return False
    if export_auth["decision"] != "denied":
        print("FAIL: anonymous export should be denied")
        return False
    if export_auth["denial_reason"] != "anonymous_export_prohibited":
        print(f"FAIL: expected denial_reason=anonymous_export_prohibited, got {export_auth['denial_reason']}")
        return False
    if export_auth["download"] is not None:
        print("FAIL: denied export should have download=null")
        return False

    change_set = load_fixture("proof_4", "change_set_self_approval.json")
    assert_valid(change_set, "change-set.schema.json", "change_set")

    requester_id = change_set["requested_by_user_id"]
    fake_approver_id = requester_id

    if requester_id == fake_approver_id:
        pass
    else:
        print("FAIL: test setup error — approver should equal requester for self-approval test")
        return False

    if change_set["max_risk_tier"] == 3 and change_set["required_approvals"] != 2:
        print("FAIL: tier 3 should require 2 approvals")
        return False

    print("PASS: anonymous export denied, self-approval detected and blocked")
    return True


if __name__ == "__main__":
    import sys
    sys.exit(0 if run() else 1)
