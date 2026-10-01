#!/usr/bin/env python3
"""test_lock: PreToolUse hook for Edit|Write (and Bash).

While the file .claude/state/test-lock exists, blocks changes to tests so a
fix task cannot weaken the failing test that defines it:
- any path with a `tests/` or `__tests__/` folder;
- any file named *.test.* or *.spec.*;
- anything under evals/.

For Bash it blocks commands that remove, move or overwrite the lock file, and
commands that write to locked paths (redirection, sed -i, cp, mv, rm, tee).

The engineer who starts a fix task creates the lock, for example:
  mkdir -p .claude/state && echo "INT-xx fix; set by <name>" > .claude/state/test-lock
and removes it in their own terminal when the fix is reviewed.

Exit 0 allows. Exit 2 blocks with the reason on stderr.

Sources: 05-PROJECT-PLAN section 11 (hooks enforce deterministic local checks);
07-SKILLS-AND-AGENTS section 9 (test gates); bug fixes start with a failing
test committed first.
"""
import json
import os
import re
import sys

HOOK = "test_lock"
LOCK_REL = ".claude/state/test-lock"
ROUTE = (
    "Tests are locked for this fix task. Change the code, not the test. If the test "
    "itself is wrong, stop and tell the engineer who set the lock; only they remove "
    ".claude/state/test-lock (in their own terminal) or approve the test change in "
    "the pull request."
)

TEST_DIRS = {"tests", "__tests__"}
TEST_NAME = re.compile(r"\.(?:test|spec)\.[^/]+$")
LOCKED_PATH_IN_CMD = re.compile(
    r"(?:^|[\s\"'=/])(?:tests|__tests__|evals)/|\.(?:test|spec)\.[A-Za-z0-9]+\b")
WRITE_VERBS = re.compile(
    r"\bsed\s+(?:-[^\s]*\s+)*-i|\bperl\s+-[^\s]*i|\btee\b|\bcp\b|\bmv\b|\brm\b|"
    r"\btruncate\b|\bunlink\b|\bdd\b|\bgit\s+(?:checkout|restore|rm|mv|apply|stash)\b")
REDIRECT_TARGET = re.compile(r"(?<![0-9&<])>{1,2}\|?\s*[\"']?(?P<target>[^\s;|&\"'<>]+)")
LOCK_IN_CMD = re.compile(r"\.claude/state(?:/test-lock)?\b|test-lock")


def block(reason):
    sys.stderr.write("BLOCKED by %s: %s\nApproval route: %s\n" % (HOOK, reason, ROUTE))
    sys.exit(2)


def project_dir(data):
    return os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or os.getcwd()


def relative_paths(file_path, root, cwd):
    if not file_path:
        return []
    path = file_path if os.path.isabs(file_path) else os.path.join(cwd or root, file_path)
    results = []
    for candidate, base in ((os.path.normpath(path), os.path.normpath(root)),
                            (os.path.realpath(path), os.path.realpath(root))):
        rel = os.path.relpath(candidate, base).replace(os.sep, "/")
        if rel != ".." and not rel.startswith("../") and rel not in results:
            results.append(rel)
    return results


def is_locked_path(rel):
    parts = rel.split("/")
    if parts[0] == "evals":
        return True
    if any(part in TEST_DIRS for part in parts[:-1]):
        return True
    return bool(TEST_NAME.search(parts[-1]))


def lock_reason(root):
    try:
        with open(os.path.join(root, LOCK_REL), "r", encoding="utf-8") as handle:
            text = handle.read(200).strip()
    except OSError:
        text = ""
    return (" Lock note: %s" % text) if text else ""


def main():
    raw = sys.stdin.read()
    try:
        data = json.loads(raw) if raw.strip() else {}
    except ValueError:
        block("hook input is not valid JSON, so the call could not be checked")
    if not isinstance(data, dict):
        block("hook input is not a JSON object, so the call could not be checked")
    root = project_dir(data)
    if not os.path.exists(os.path.join(root, LOCK_REL)):
        sys.exit(0)
    tool_input = data.get("tool_input") or {}
    if not isinstance(tool_input, dict):
        sys.exit(0)
    note = lock_reason(root)

    if (data.get("tool_name") or "") == "Bash":
        command = str(tool_input.get("command") or "")
        targets = [m.group("target").lstrip("./") for m in REDIRECT_TARGET.finditer(command)]
        if LOCK_IN_CMD.search(command) and (WRITE_VERBS.search(command)
                                            or any(LOCK_IN_CMD.search(t) for t in targets)):
            block("command would remove or change the test lock." + note)
        if any(is_locked_path(t) for t in targets):
            block("command redirects output into a locked test or eval file." + note)
        if LOCKED_PATH_IN_CMD.search(command) and WRITE_VERBS.search(command):
            block("command may write to locked test or eval files." + note)
        sys.exit(0)

    rels = relative_paths(tool_input.get("file_path") or "", root, data.get("cwd"))
    for rel in rels:
        if is_locked_path(rel):
            block("%s is a test or eval file and tests are locked." % rel + note)
    sys.exit(0)


if __name__ == "__main__":
    main()
