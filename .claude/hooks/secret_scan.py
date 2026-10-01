#!/usr/bin/env python3
"""secret_scan: PreToolUse hook for Edit|Write.

Blocks new file content that contains private keys, Google service-account
JSON, common API keys and tokens, or .env-style secret assignments with real
values. Obvious placeholders such as <SECRET>, changeme or example pass.

Contract (Claude Code hooks): JSON on stdin with tool_name and tool_input.
Exit 0 allows the call. Exit 2 blocks it; the reason goes to stderr.

Standard library only. Self-contained so the organization can also deploy it
as a managed hook. Secrets are never echoed back: messages show a redacted
preview only.

Sources: 04-CLAUDE-CODE-BUILD-PROMPT section 19 and 24, 02-DETAILED-SPECIFICATION
section 17, 07-SKILLS-AND-AGENTS section 9.
"""
import json
import re
import sys

HOOK = "secret_scan"
ROUTE = (
    "Remove the secret from the file. Store it in Secret Manager and reference "
    "it by name (for example projects/<project>/secrets/<name>), or use a "
    "placeholder such as <SECRET>. If this is a false positive, ask the "
    "security engineer to review a pull request that adjusts "
    ".claude/hooks/secret_scan.py and its tests. Never paste real credentials "
    "into a Claude Code session."
)

# Substrings that mark a value as an obvious placeholder (case-insensitive).
PLACEHOLDER_MARKERS = (
    "<", ">", "changeme", "change_me", "change-me", "example", "placeholder",
    "dummy", "redacted", "replace", "your_", "your-", "todo", "xxxx", "****",
    "...", "decide_at_m0", "fake", "sample", "not-a-real", "not_a_real",
)

# Values that reference a secret instead of containing it.
REFERENCE_PREFIXES = (
    "$", "process.env", "os.environ", "os.getenv", "projects/",
)


def block(reason):
    sys.stderr.write("BLOCKED by %s: %s\nApproval route: %s\n" % (HOOK, reason, ROUTE))
    sys.exit(2)


def is_placeholder(value):
    low = value.lower()
    if any(marker in low for marker in PLACEHOLDER_MARKERS):
        return True
    # Very low variety (for example "aaaaaaaa...") is not a real credential.
    return len(set(value)) < 6


def looks_random(body, need_mixed_case=False):
    if len(set(body)) < 8:
        return False
    if not any(c.isdigit() for c in body) or not any(c.isalpha() for c in body):
        return False
    if need_mixed_case:
        return any(c.islower() for c in body) and any(c.isupper() for c in body)
    return True


def redact(value):
    value = value.strip()
    return (value[:4] + "...(redacted)") if len(value) > 4 else "(redacted)"


# (name, compiled regex, randomness check or None)
TOKEN_PATTERNS = [
    ("Anthropic API key",
     re.compile(r"(?<![A-Za-z0-9_-])sk-ant-[A-Za-z0-9_\-]{20,}"),
     lambda m: looks_random(m[len("sk-ant-"):])),
    ("OpenAI API key",
     re.compile(r"(?<![A-Za-z0-9_-])sk-(?!ant-)(?:proj-|svcacct-|admin-)?[A-Za-z0-9_\-]{20,}"),
     lambda m: looks_random(m[3:], need_mixed_case=True)),
    ("GitHub token",
     re.compile(r"(?<![A-Za-z0-9_])(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}"),
     lambda m: looks_random(m[4:])),
    ("GitHub fine-grained token",
     re.compile(r"(?<![A-Za-z0-9_])github_pat_[A-Za-z0-9_]{22,}"),
     lambda m: looks_random(m[11:])),
    ("Slack token",
     re.compile(r"(?<![A-Za-z0-9])xox[abposr]-[A-Za-z0-9-]{10,}"),
     lambda m: sum(c.isdigit() for c in m) >= 2 and len(set(m)) >= 8),
    ("Slack webhook URL",
     re.compile(r"https://hooks\.slack\.com/services/T[A-Za-z0-9]+/B[A-Za-z0-9]+/[A-Za-z0-9]+"),
     None),
    ("Google API key",
     re.compile(r"(?<![A-Za-z0-9_-])AIza[0-9A-Za-z_\-]{35}(?![0-9A-Za-z_\-])"),
     lambda m: looks_random(m[4:])),
    ("Google OAuth client secret",
     re.compile(r"(?<![A-Za-z0-9_-])GOCSPX-[A-Za-z0-9_\-]{20,}"),
     lambda m: looks_random(m[7:])),
    ("AWS access key ID",
     re.compile(r"(?<![A-Z0-9])(?:AKIA|ASIA)[0-9A-Z]{16}(?![A-Z0-9])"),
     lambda m: len(set(m[4:])) >= 6),
]

PRIVATE_KEY_BLOCK = re.compile(
    r"-----BEGIN ((?:RSA|DSA|EC|OPENSSH|ENCRYPTED|PGP) )?PRIVATE KEY( BLOCK)?-----"
    r"(?P<body>.*?)(?:-----END [A-Z ]*PRIVATE KEY( BLOCK)?-----|\Z)",
    re.DOTALL,
)

SA_PRIVATE_KEY = re.compile(r'"private_key"\s*:\s*"((?:[^"\\]|\\.)*)"')
SA_CLIENT_EMAIL = re.compile(r'"client_email"\s*:')

ENV_ASSIGNMENT = re.compile(
    r"^\s*(?:export\s+)?"
    r"(?P<name>[A-Z][A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|API_KEY|APIKEY|PRIVATE_KEY))"
    r"\s*(?:=|:\s)\s*(?P<value>.*)$"
)


def line_of(text, index):
    return text.count("\n", 0, index) + 1


def clean_env_value(raw):
    value = raw.strip()
    if value[:1] in ("'", '"'):
        quote = value[0]
        end = value.find(quote, 1)
        return value[1:end] if end > 0 else value[1:]
    # Unquoted: drop a trailing comment.
    value = re.split(r"\s+#", value, maxsplit=1)[0]
    return value.strip()


def scan(text):
    findings = []

    for m in PRIVATE_KEY_BLOCK.finditer(text):
        body = re.sub(r"\s+", "", m.group("body") or "")
        if len(body) < 40 or is_placeholder(body[:200]):
            continue
        findings.append("private key block at line %d" % line_of(text, m.start()))

    if SA_CLIENT_EMAIL.search(text):
        for m in SA_PRIVATE_KEY.finditer(text):
            value = m.group(1)
            if len(value) < 40 or is_placeholder(value):
                continue
            findings.append(
                "Google service-account JSON (private_key with client_email) at line %d"
                % line_of(text, m.start()))

    for name, pattern, check in TOKEN_PATTERNS:
        for m in pattern.finditer(text):
            token = m.group(0)
            if is_placeholder(token):
                continue
            if check is not None and not check(token):
                continue
            findings.append("%s at line %d: %s" % (name, line_of(text, m.start()), redact(token)))

    for number, line in enumerate(text.splitlines(), start=1):
        m = ENV_ASSIGNMENT.match(line)
        if not m:
            continue
        value = clean_env_value(m.group("value"))
        if not value or len(value) < 8:
            continue
        if value.startswith(REFERENCE_PREFIXES) or "(" in value:
            continue
        if is_placeholder(value):
            continue
        findings.append("secret assignment %s at line %d: %s" % (m.group("name"), number, redact(value)))

    return findings


def new_text(tool_name, tool_input):
    if tool_name == "Write":
        return tool_input.get("content") or ""
    if tool_name == "Edit":
        return tool_input.get("new_string") or ""
    # Defensive: a multi-edit payload with an "edits" list.
    edits = tool_input.get("edits")
    if isinstance(edits, list):
        return "\n".join(str(e.get("new_string") or "") for e in edits if isinstance(e, dict))
    return ""


def main():
    raw = sys.stdin.read()
    try:
        data = json.loads(raw) if raw.strip() else {}
    except ValueError:
        block("hook input is not valid JSON, so the content could not be checked")
    if not isinstance(data, dict):
        block("hook input is not a JSON object, so the content could not be checked")
    tool_input = data.get("tool_input") or {}
    if not isinstance(tool_input, dict):
        sys.exit(0)
    text = new_text(data.get("tool_name") or "", tool_input)
    if not text:
        sys.exit(0)
    findings = scan(text)
    if findings:
        target = tool_input.get("file_path") or "(unknown file)"
        block("possible secret in %s: %s" % (target, "; ".join(findings[:5])))
    sys.exit(0)


if __name__ == "__main__":
    main()
