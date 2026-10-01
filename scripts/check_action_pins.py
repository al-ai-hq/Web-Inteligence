#!/usr/bin/env python3
"""Fail when a GitHub Actions `uses:` line is not pinned to a commit SHA."""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
USES = re.compile(r"^\s*-?\s*uses:\s*(\S+)")
PINNED = re.compile(r"@[0-9a-f]{40}(?:\s|$)")


def unpinned(text):
    found = []
    for number, line in enumerate(text.splitlines(), 1):
        stripped = line.strip()
        if stripped.startswith("#"):
            continue
        match = USES.match(line)
        if not match:
            continue
        ref = match.group(1)
        if ref.startswith("./"):
            continue
        if PINNED.search(ref) is None:
            found.append((number, stripped))
    return found


def main():
    workflows = sorted((ROOT / ".github" / "workflows").glob("*.yml"))
    if not workflows:
        print("No workflow files found.", file=sys.stderr)
        return 1
    bad = []
    for path in workflows:
        for number, line in unpinned(path.read_text(encoding="utf-8")):
            bad.append("%s:%s: %s" % (path.relative_to(ROOT), number, line))
    if bad:
        print("Unpinned GitHub Actions:", file=sys.stderr)
        print("\n".join(bad), file=sys.stderr)
        return 1
    print("OK: action pins checked in %s workflow file(s)." % len(workflows))
    return 0


if __name__ == "__main__":
    sys.exit(main())
