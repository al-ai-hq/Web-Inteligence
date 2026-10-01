#!/usr/bin/env python3
"""Proof 3: Trace every report number to evidence through lineage records."""

from scripts.proofs.helpers import (
    assert_valid,
    load_fixture,
)

FIDELITY_TO_EVIDENCE_STATE = {
    "observed": "verified",
    "computed": "verified",
    "assessed": "inferred",
    "attested": "client_stated",
    "user_supplied": "client_stated",
    "estimated": "estimated",
    "unavailable": "unavailable",
}


def run() -> bool:
    report = load_fixture("proof_3", "report.json")
    assert_valid(report, "report-model.schema.json", "report")

    lineage_records = load_fixture("proof_3", "lineage_records.json")
    for lr in lineage_records:
        assert_valid(lr, "lineage-record.schema.json", f"lineage {lr['record_id']}")

    evidence_objects = load_fixture("proof_3", "evidence_objects.json")
    for ev in evidence_objects:
        assert_valid(ev, "evidence-object.schema.json", f"evidence {ev['evidence_id']}")

    evidence_by_id = {ev["evidence_id"]: ev for ev in evidence_objects}
    lineage_by_record_id = {lr["record_id"]: lr for lr in lineage_records}

    all_number_ids = (
        report["content"]["score_result_ids"] + report["content"]["finding_ids"]
    )

    if report["status"] == "ready" and report["lineage_coverage"]["ratio"] != 1:
        print("FAIL: report status=ready but lineage_coverage ratio != 1")
        return False

    for number_id in all_number_ids:
        if number_id not in lineage_by_record_id:
            print(f"FAIL: report number {number_id} has no lineage record")
            return False

        lr = lineage_by_record_id[number_id]
        chain_complete = False

        for parent_id in lr["parent_ids"]:
            if parent_id in evidence_by_id:
                ev = evidence_by_id[parent_id]
                if not ev.get("lineage", {}).get("content_hash"):
                    print(f"FAIL: evidence {parent_id} has no content_hash")
                    return False
                lr_fidelity = lr["fidelity_label"]
                ev_fidelity = ev["lineage"]["fidelity_label"]
                expected_state = FIDELITY_TO_EVIDENCE_STATE.get(lr_fidelity)
                if lr_fidelity == "unavailable" and expected_state == "verified":
                    print(f"FAIL: lineage {lr['record_id']} has fidelity=unavailable but maps to verified")
                    return False
                chain_complete = True

        if not chain_complete:
            print(f"FAIL: lineage chain for {number_id} does not reach any evidence object")
            return False

    print(f"PASS: all {len(all_number_ids)} report numbers trace to evidence")
    return True


if __name__ == "__main__":
    import sys
    sys.exit(0 if run() else 1)
