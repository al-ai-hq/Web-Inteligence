#!/usr/bin/env python3
"""Run all 5 M0B exit-gate proofs and print a summary."""

import importlib
import sys
import time

PROOFS = [
    ("proof_1_reproduce_score", "Reproduce score"),
    ("proof_2_reject_invalid", "Reject invalid record"),
    ("proof_3_trace_lineage", "Trace report number to evidence"),
    ("proof_4_deny_unauthorized", "Deny unauthorized export/write"),
    ("proof_5_cost_hard_stop", "Simulate USD 150 hard stop"),
]


def main() -> int:
    results = []
    for module_name, label in PROOFS:
        start = time.monotonic()
        try:
            mod = importlib.import_module(f"scripts.proofs.{module_name}")
            ok = mod.run()
        except SystemExit as e:
            ok = e.code == 0
        except Exception as exc:
            print(f"Proof {module_name} raised: {exc}")
            ok = False
        elapsed = time.monotonic() - start
        status = "PASS" if ok else "FAIL"
        dots = "." * max(1, 36 - len(label))
        print(f"  {label} {dots} {status} ({elapsed:.1f}s)")
        results.append(ok)

    passed = sum(results)
    total = len(results)
    print()
    print(f"  {passed}/{total} passed.", end=" ")
    if passed == total:
        print("Exit gate: OPEN.")
        return 0
    else:
        print("Exit gate: BLOCKED.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
