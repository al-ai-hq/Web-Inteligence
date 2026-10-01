#!/usr/bin/env python3
"""Proof 2: Reject invalid records — SSRF URL and unknown fidelity label."""

import ipaddress
from urllib.parse import urlparse

from scripts.proofs.helpers import load_fixture, validate

SSRF_BLOCKED_NETWORKS = [
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
]


def url_is_ssrf(url: str) -> bool:
    """Check if a URL targets a private/reserved network."""
    parsed = urlparse(url)
    hostname = parsed.hostname
    if not hostname:
        return True
    try:
        addr = ipaddress.ip_address(hostname)
        return any(addr in net for net in SSRF_BLOCKED_NETWORKS)
    except ValueError:
        return False


def run() -> bool:
    audit_ssrf = load_fixture("proof_2", "audit_ssrf.json")
    target_url = audit_ssrf["target_url"]
    if not url_is_ssrf(target_url):
        print(f"FAIL: SSRF URL {target_url} was not detected as SSRF")
        return False

    rule_bad = load_fixture("proof_2", "rule_result_bad_fidelity.json")
    errors = validate(rule_bad, "rule-result.schema.json")
    if not errors:
        print("FAIL: rule_result with fidelity_label='guessed' should fail validation")
        return False

    fidelity_errors = [e for e in errors if "fidelity_label" in e]
    if not fidelity_errors:
        print(f"FAIL: expected fidelity_label validation error, got: {errors}")
        return False

    print(f"PASS: SSRF URL rejected, invalid fidelity_label rejected ({len(errors)} schema error(s))")
    return True


if __name__ == "__main__":
    import sys
    sys.exit(0 if run() else 1)
