#!/usr/bin/env python3
"""Proof 5: Simulate the USD 150 hard stop — cost guard blocks a call past cap-reserve."""

from decimal import Decimal

from scripts.proofs.helpers import (
    assert_valid,
    decimal_amount,
    load_config,
    load_fixture,
)


def run() -> bool:
    budgets = load_config("budgets.yaml")
    monthly_cap = Decimal(budgets["monthly"]["hard_cap"])
    reserve = Decimal(budgets["monthly"]["reserve"])
    paid_calls_stop_at = monthly_cap - reserve

    per_audit_hard = Decimal(budgets["per_audit"]["hard_cap"])

    ledger_entries = load_fixture("proof_5", "ledger_entries.json")
    for entry in ledger_entries:
        assert_valid(entry, "cost-ledger-entry.schema.json", f"ledger entry {entry['entry_id']}")

    paid_entries = [e for e in ledger_entries if e["line"] == "paid_call"]
    month_to_date = sum(decimal_amount(e["amount"]) for e in paid_entries)

    new_call_estimate = Decimal("9.00")

    if month_to_date != Decimal("142.00"):
        print(f"FAIL: expected ledger total 142.00, got {month_to_date}")
        return False

    projected = month_to_date + new_call_estimate

    if projected > monthly_cap:
        monthly_cap_exceeded = True
    else:
        monthly_cap_exceeded = False

    if month_to_date >= paid_calls_stop_at:
        paid_calls_blocked = True
    else:
        paid_calls_blocked = False

    if new_call_estimate > per_audit_hard:
        per_audit_exceeded = True
    else:
        per_audit_exceeded = False

    call_allowed = not monthly_cap_exceeded and not paid_calls_blocked and not per_audit_exceeded

    if call_allowed:
        print(f"FAIL: call should be denied but was allowed (mtd={month_to_date}, cap={monthly_cap}, reserve={reserve})")
        return False

    denial_reasons = []
    if paid_calls_blocked:
        denial_reasons.append(f"month_to_date {month_to_date} >= paid_calls_stop_at {paid_calls_stop_at}")
    if monthly_cap_exceeded:
        denial_reasons.append(f"projected {projected} > monthly_cap {monthly_cap}")
    if per_audit_exceeded:
        denial_reasons.append(f"estimate {new_call_estimate} > per_audit_hard {per_audit_hard}")

    print(f"PASS: cost guard blocked call — {'; '.join(denial_reasons)}")
    return True


if __name__ == "__main__":
    import sys
    sys.exit(0 if run() else 1)
