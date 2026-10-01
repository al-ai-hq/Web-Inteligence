#!/usr/bin/env python3
"""Cursor hook gate for Website Presence Intelligence.

Cloud agents and the native Cursor hook loader read `.cursor/hooks.json`.
They do not run `.claude/settings.json` unless third-party imports are on.
This gate turns Cursor's hook JSON into the Claude Code payload the tested
scripts in `.claude/hooks/` already understand, then returns Cursor's
permission JSON.

Modes (first argument): files, shell, read, format, session.
"""
import json
import os
import re
import subprocess
import sys

ROOT = os.environ.get("CURSOR_PROJECT_DIR") or os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
HOOKS = os.path.join(ROOT, ".claude", "hooks")

FILE_HOOKS = (
    "secret_scan.py",
    "forbidden_endpoints.py",
    "agent_allowlist_guard.py",
    "methodology_bump.py",
    "protect_prod_infra.py",
    "test_lock.py",
)
SHELL_HOOKS = (
    "dangerous_bash.py",
    "protect_prod_infra.py",
    "test_lock.py",
)

# Same ask-list as .claude/settings.json permissions.ask. Deny hooks run first.
ASK_PATTERNS = (
    re.compile(r"(?:^|[;&|()\n])\s*git\s+push\b"),
    re.compile(r"(?:^|[;&|()\n])\s*git\s+commit\b"),
    re.compile(r"(?:^|[;&|()\n])\s*pnpm\s+(?:install|add)\b"),
    re.compile(r"(?:^|[;&|()\n])\s*gcloud\b"),
    re.compile(r"(?:^|[;&|()\n])\s*terraform\s+(?:plan|init)\b"),
    re.compile(r"(?:^|[;&|()\n])\s*git\s+-C\b"),
    re.compile(r"(?:^|[;&|()\n])\s*git\s+reset\b"),
    re.compile(r"(?:^|[;&|()\n])\s*git\s+clean\b"),
    re.compile(r"(?:^|[;&|()\n])\s*git\s+checkout\s+--"),
    re.compile(r"(?:^|[;&|()\n])\s*git\s+restore\b"),
    re.compile(r"(?:^|[;&|()\n])\s*git\s+rebase\b"),
    re.compile(r"(?:^|[;&|()\n])\s*npx\b"),
    re.compile(r"(?:^|[;&|()\n])\s*npm\s+(?:install|i)\b"),
    re.compile(r"(?:^|[;&|()\n])\s*pnpm\s+dlx\b"),
    re.compile(r"(?:^|[;&|()\n])\s*pip3?\s+install\b"),
)

SAFE_ENV_NAMES = {".env.example", ".env.sample", ".env.template", ".env.dist"}
SKIP_FILE_TOOLS = {"Read", "Grep", "Glob", "Task", "SemanticSearch", "AwaitShell", "LS"}


def emit(permission, message, code=None):
    payload = {"permission": permission}
    if message:
        payload["user_message"] = message
        payload["agent_message"] = message
    sys.stdout.write(json.dumps(payload))
    if code is None:
        code = 2 if permission == "deny" else 0
    sys.exit(code)


def load_input():
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        data = json.loads(raw)
    except ValueError:
        emit("deny", "Cursor hook input is not valid JSON, so the call could not be checked.")
    if not isinstance(data, dict):
        emit("deny", "Cursor hook input is not a JSON object, so the call could not be checked.")
    return data


def project_env():
    env = os.environ.copy()
    env["CLAUDE_PROJECT_DIR"] = ROOT
    env["CURSOR_PROJECT_DIR"] = ROOT
    return env


def run_claude(script, payload):
    path = os.path.join(HOOKS, script)
    if not os.path.isfile(path):
        return 2, "missing hook %s" % script
    proc = subprocess.run(
        [sys.executable, path],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        cwd=ROOT,
        env=project_env(),
    )
    detail = (proc.stderr or proc.stdout or "").strip()
    return proc.returncode, detail


def enforce(scripts, payload):
    for script in scripts:
        code, detail = run_claude(script, payload)
        if code == 2:
            emit("deny", detail or ("BLOCKED by %s" % script))
        if code != 0:
            emit("deny", detail or ("%s failed with exit %s" % (script, code)))


def first(mapping, *keys):
    for key in keys:
        if key in mapping and mapping[key] is not None:
            return mapping[key]
    return None


def normalize_file(data):
    tool_input = data.get("tool_input")
    if not isinstance(tool_input, dict):
        tool_input = {}
    path = first(tool_input, "file_path", "path", "filePath") or data.get("file_path") or ""
    content = first(tool_input, "content", "contents")
    edits = tool_input.get("edits") if isinstance(tool_input.get("edits"), list) else None
    if edits is None and isinstance(data.get("edits"), list):
        edits = data.get("edits")
    pieces = []
    if edits:
        for edit in edits:
            if isinstance(edit, dict):
                pieces.append((edit.get("old_string") or "", edit.get("new_string") or ""))
    elif "old_string" in tool_input or "new_string" in tool_input:
        pieces.append((tool_input.get("old_string") or "", tool_input.get("new_string") or ""))

    cwd = data.get("cwd") or ""
    if content is not None and not pieces:
        return {"tool_name": "Write", "tool_input": {"file_path": path, "content": str(content)}, "cwd": cwd}

    if not pieces:
        return {"tool_name": "Write", "tool_input": {"file_path": path, "content": ""}, "cwd": cwd}

    abs_path = path if os.path.isabs(path) else os.path.join(cwd or ROOT, path)
    try:
        with open(abs_path, "r", encoding="utf-8") as handle:
            current = handle.read()
    except OSError:
        current = None
    if current is None:
        joined = "\n".join(new for _, new in pieces)
        return {"tool_name": "Write", "tool_input": {"file_path": path, "content": joined}, "cwd": cwd}

    proposed = current
    for old, new in pieces:
        if old and old in proposed:
            proposed = proposed.replace(old, new, 1)
            continue
        return {
            "tool_name": "Edit",
            "tool_input": {"file_path": path, "old_string": pieces[0][0], "new_string": pieces[0][1]},
            "cwd": cwd,
        }
    return {"tool_name": "Write", "tool_input": {"file_path": path, "content": proposed}, "cwd": cwd}


def shell_payload(data):
    command = data.get("command")
    if command is None:
        tool_input = data.get("tool_input")
        if isinstance(tool_input, dict):
            command = tool_input.get("command")
    return {
        "tool_name": "Bash",
        "tool_input": {"command": "" if command is None else str(command)},
        "cwd": data.get("cwd") or "",
    }


def normalize_read_path(file_path):
    path = os.path.expanduser(file_path or "")
    if not os.path.isabs(path):
        path = os.path.abspath(os.path.join(ROOT, path))
    return os.path.realpath(path) if os.path.exists(path) else os.path.normpath(path)


def sensitive_read(file_path):
    if not file_path:
        return None
    path = normalize_read_path(file_path)
    name = os.path.basename(path)
    home = os.path.realpath(os.path.expanduser("~"))
    try:
        home_rel = os.path.relpath(path, home).replace(os.sep, "/")
    except ValueError:
        home_rel = ""
    try:
        root_rel = os.path.relpath(path, os.path.realpath(ROOT)).replace(os.sep, "/")
    except ValueError:
        root_rel = path.replace(os.sep, "/")

    if name == ".env" or (name.startswith(".env.") and name not in SAFE_ENV_NAMES):
        return "reading %s is denied; use a template env file or Secret Manager" % name
    if root_rel == "secrets" or root_rel.startswith("secrets/"):
        return "reading secrets/ is denied"
    if name.endswith(".pem") or name.endswith("-key.json"):
        return "reading key material (%s) is denied" % name
    if name in ("application_default_credentials.json", ".netrc", ".git-credentials"):
        return "reading credential file %s is denied" % name
    for prefix in (".config/gcloud", ".aws", ".ssh"):
        if home_rel == prefix or home_rel.startswith(prefix + "/"):
            return "reading ~/%s is denied" % prefix
    return None


def mode_files(data):
    tool = data.get("tool_name") or ""
    if tool in ("WebFetch", "WebSearch"):
        emit(
            "ask",
            "WebFetch and WebSearch need a human to approve the fetch in this repository.",
            code=0,
        )
    if tool in ("Shell", "Bash") or tool in SKIP_FILE_TOOLS:
        emit("allow", "", code=0)
    payload = normalize_file(data)
    tool_input = payload["tool_input"]
    if not tool_input.get("file_path") and not tool_input.get("content") and not tool_input.get("new_string"):
        emit("allow", "", code=0)
    enforce(FILE_HOOKS, payload)
    emit("allow", "", code=0)


def mode_shell(data):
    payload = shell_payload(data)
    enforce(SHELL_HOOKS, payload)
    command = payload["tool_input"]["command"]
    if any(pattern.search(command) for pattern in ASK_PATTERNS):
        emit("ask", "This command is on the repository ask list. Approve it before it runs.", code=0)
    emit("allow", "", code=0)


def mode_read(data):
    reason = sensitive_read(data.get("file_path") or "")
    if reason:
        emit("deny", reason)
    emit("allow", "", code=0)


def mode_format(data):
    payload = normalize_file(data)
    if not payload["tool_input"].get("file_path"):
        sys.exit(0)
    code, detail = run_claude("format_changed.py", payload)
    if code not in (0, 2):
        sys.stderr.write(detail + "\n")
        sys.exit(code)
    sys.exit(0)


def mode_session(_data):
    sys.stdout.write(json.dumps({
        "additional_context": (
            "Website Presence Intelligence. Follow AGENTS.md. "
            "Work one milestone at a time, start in Plan mode, and wait for human approval "
            "before editing. Do not spawn subagents from a subagent. "
            "Governance checks: python3 -m unittest discover -s .claude/hooks/tests; "
            "python3 -m unittest discover -s .cursor/hooks/tests; "
            "python3 scripts/check_schemas.py; python3 scripts/check_config.py."
        )
    }))
    sys.exit(0)


MODES = {
    "files": mode_files,
    "shell": mode_shell,
    "read": mode_read,
    "format": mode_format,
    "session": mode_session,
}


EVENT_MODES = {
    "preToolUse": "files",
    "beforeShellExecution": "shell",
    "beforeReadFile": "read",
    "beforeTabFileRead": "read",
    "afterFileEdit": "format",
    "sessionStart": "session",
}


def main():
    if len(sys.argv) == 2 and sys.argv[1] in MODES:
        mode = sys.argv[1]
        data = load_input()
    elif len(sys.argv) == 1:
        data = load_input()
        mode = EVENT_MODES.get(data.get("hook_event_name") or "")
        if mode is None:
            emit("deny", "gate.py could not tell which hook event this is.")
    else:
        sys.stderr.write("usage: gate.py [files|shell|read|format|session]\n")
        sys.exit(2)
    MODES[mode](data)


if __name__ == "__main__":
    main()
