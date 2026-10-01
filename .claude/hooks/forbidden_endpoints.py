#!/usr/bin/env python3
"""forbidden_endpoints: PreToolUse hook for Edit|Write.

Blocks code that calls Google Autocomplete (suggestqueries) or Google result
pages, and code in apps/, services/ or packages/ that imports or runs the
vendored skill's scripts (decision D-009).

Allowed locations: docs/, .claude/skills/, .cursor/skills/ (links to the same skills), and test fixtures (any folder named
fixtures, __fixtures__ or testdata, and evals/golden/). Documentation files
(.md, .mdx, .markdown, .txt, .rst) are not code and are not scanned.
Comment lines may mention the skill's script path, so ported code can record
its provenance.

Exit 0 allows. Exit 2 blocks with the reason on stderr.

Sources: 02-DETAILED-SPECIFICATION section 7 (no Autocomplete, no result-page
scraping) and section 13; 04-CLAUDE-CODE-BUILD-PROMPT section 25; decision D-009.
"""
import json
import os
import re
import sys

HOOK = "forbidden_endpoints"
ROUTE = (
    "The product must not call Google Autocomplete or scrape Google result pages, "
    "and application code must not import or run the skill's scripts (D-009). "
    "Port the logic and test it against evals/golden/ instead. Mentions belong in "
    "docs/ or .claude/skills/. Changing this policy needs a new decision in "
    "docs/decisions.md approved by the product owner and SEO lead, then a reviewed "
    "pull request that updates this hook and its tests."
)

ALLOWED_PREFIXES = ("docs/", ".claude/skills/", ".cursor/skills/", "evals/golden/")
FIXTURE_DIRS = {"fixtures", "__fixtures__", "testdata"}
DOC_EXTENSIONS = {".md", ".mdx", ".markdown", ".txt", ".rst"}
APP_PREFIXES = ("apps/", "services/", "packages/")

GOOGLE_HOST_TLD = r"google\.(?:com|[a-z]{2}|com?\.[a-z]{2})"
ENDPOINT_PATTERNS = [
    ("Google Autocomplete endpoint (suggestqueries)",
     re.compile(r"suggestqueries\.google\.[a-z.]+", re.IGNORECASE)),
    ("Google Autocomplete endpoint (complete/search)",
     re.compile(r"(?<![\w.-])(?:https?://)?(?:www\.|clients\d*\.)?" + GOOGLE_HOST_TLD
                + r"/complete/search", re.IGNORECASE)),
    ("Google result page (google.<tld>/search)",
     re.compile(r"(?<![\w.-])(?:https?://)?(?:www\.)?" + GOOGLE_HOST_TLD
                + r"/search(?![\w-])", re.IGNORECASE)),
]

SKILL_SCRIPT_PATTERNS = [
    ("reference to the vendored skill's scripts",
     re.compile(r"marketing[-_]seo[-_]agent[/\\._]+scripts", re.IGNORECASE)),
    ("reference to .claude/skills from application code",
     re.compile(r"\.claude[/\\]skills", re.IGNORECASE)),
]

COMMENT_PREFIXES = ("#", "//", "*", "/*", "<!--", "--", ";")


def block(reason):
    sys.stderr.write("BLOCKED by %s: %s\nApproval route: %s\n" % (HOOK, reason, ROUTE))
    sys.exit(2)


def project_dir(data):
    return os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or os.getcwd()


def relative_paths(file_path, root, cwd):
    """Return project-relative POSIX paths (plain and symlink-resolved)."""
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


def is_exempt(rel):
    if rel.startswith(ALLOWED_PREFIXES):
        return True
    parts = rel.split("/")
    if any(part in FIXTURE_DIRS for part in parts[:-1]):
        return True
    return os.path.splitext(rel)[1].lower() in DOC_EXTENSIONS


def new_text(tool_name, tool_input):
    if tool_name == "Write":
        return tool_input.get("content") or ""
    if tool_name == "Edit":
        return tool_input.get("new_string") or ""
    edits = tool_input.get("edits")
    if isinstance(edits, list):
        return "\n".join(str(e.get("new_string") or "") for e in edits if isinstance(e, dict))
    return ""


def main():
    raw = sys.stdin.read()
    try:
        data = json.loads(raw) if raw.strip() else {}
    except ValueError:
        block("hook input is not valid JSON, so the change could not be checked")
    if not isinstance(data, dict):
        block("hook input is not a JSON object, so the change could not be checked")
    tool_input = data.get("tool_input") or {}
    if not isinstance(tool_input, dict):
        sys.exit(0)
    text = new_text(data.get("tool_name") or "", tool_input)
    if not text:
        sys.exit(0)
    root = project_dir(data)
    rels = relative_paths(tool_input.get("file_path") or "", root, data.get("cwd"))
    if not rels:
        # Outside the project: not repository code.
        sys.exit(0)
    if all(is_exempt(rel) for rel in rels):
        sys.exit(0)

    findings = []
    lines = text.splitlines()
    for number, line in enumerate(lines, start=1):
        for name, pattern in ENDPOINT_PATTERNS:
            if pattern.search(line):
                findings.append("%s at line %d" % (name, number))
    if any(rel.startswith(APP_PREFIXES) for rel in rels):
        for number, line in enumerate(lines, start=1):
            if line.strip().startswith(COMMENT_PREFIXES):
                continue
            for name, pattern in SKILL_SCRIPT_PATTERNS:
                if pattern.search(line):
                    findings.append("%s at line %d" % (name, number))
    if findings:
        block("%s: %s" % (rels[0], "; ".join(findings[:5])))
    sys.exit(0)


if __name__ == "__main__":
    main()
