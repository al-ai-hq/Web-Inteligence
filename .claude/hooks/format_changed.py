#!/usr/bin/env python3
"""format_changed: PostToolUse hook for Edit|Write.

Runs the project formatter on the one file that was just changed, and only
when node_modules/.bin/prettier exists in the project (it appears after M0A
installs the application toolchain). Otherwise it exits 0 silently.

- Only files inside the project are formatted; node_modules is skipped.
- `--ignore-unknown` lets Prettier skip file types it does not handle.
- A formatter failure is reported with exit 1 (a non-blocking error shown to
  the user); the edit itself has already happened.

Linting stays in CI (`pnpm lint`) until M0A decides whether a lint hook is
fast enough to run per file.

Sources: 05-PROJECT-PLAN section 11 (hooks run deterministic local checks);
07-SKILLS-AND-AGENTS section 9 (formatting hooks).
"""
import json
import os
import subprocess
import sys

TIMEOUT_SECONDS = 60


def main():
    raw = sys.stdin.read()
    try:
        data = json.loads(raw) if raw.strip() else {}
    except ValueError:
        sys.exit(0)
    if not isinstance(data, dict):
        sys.exit(0)
    tool_input = data.get("tool_input") or {}
    if not isinstance(tool_input, dict):
        sys.exit(0)
    root = os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or os.getcwd()
    prettier = os.path.join(root, "node_modules", ".bin", "prettier")
    if not os.path.isfile(prettier):
        sys.exit(0)
    file_path = tool_input.get("file_path") or ""
    if not file_path:
        sys.exit(0)
    path = file_path if os.path.isabs(file_path) else os.path.join(data.get("cwd") or root, file_path)
    path = os.path.realpath(path)
    root_real = os.path.realpath(root)
    rel = os.path.relpath(path, root_real).replace(os.sep, "/")
    if rel == ".." or rel.startswith("../") or "node_modules/" in rel + "/":
        sys.exit(0)
    if not os.path.isfile(path):
        sys.exit(0)
    try:
        result = subprocess.run(
            [prettier, "--write", "--ignore-unknown", path],
            cwd=root_real, capture_output=True, text=True, timeout=TIMEOUT_SECONDS,
        )
    except (OSError, subprocess.SubprocessError) as error:
        sys.stderr.write("format_changed: could not run prettier on %s: %s\n" % (rel, error))
        sys.exit(1)
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip().splitlines()[:5]
        sys.stderr.write("format_changed: prettier failed on %s: %s\n" % (rel, " | ".join(detail)))
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
