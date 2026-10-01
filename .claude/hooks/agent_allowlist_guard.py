#!/usr/bin/env python3
"""agent_allowlist_guard: PreToolUse hook for Edit|Write on config/agents/*.yaml.

Computes the proposed file content (Write: the new content; Edit: the file on
disk with old_string replaced by new_string) and blocks the call if any
write-class tool appears in a `tools:` list. Only the deterministic connector
service may hold write credentials; no runtime AI agent may apply or publish.

YAML is read with a small line-based parser (standard library only). It
understands block lists (`- name`), list items that are mappings
(`- name: apply_change`), and flow lists (`[a, b]`, also across lines). A
`tools:` value this parser cannot verify (an alias such as `*write_tools`) is
blocked.

Exit 0 allows. Exit 2 blocks with the reason on stderr.

Sources: 02-DETAILED-SPECIFICATION section 13 (split trust), section 19
(tool-allowlist tests), 03-PRODUCTION-CONTRACTS "Agent tool boundaries",
07-SKILLS-AND-AGENTS section 6.
"""
import json
import os
import re
import sys

HOOK = "agent_allowlist_guard"
ROUTE = (
    "Write-class tools belong only to the deterministic connector service, never "
    "to a runtime AI agent (split trust). Remove the tool from `tools:`; list it "
    "under `forbidden_tools:` if useful. If you believe a tool is wrongly treated "
    "as write-class, raise it with the tech lead and security engineer and change "
    "this hook and its tests through a reviewed pull request."
)

WRITE_CLASS_TOOLS = (
    "apply_change", "publish", "write_cms", "delete_content",
    "upload_disavow", "send_email", "submit_form",
)

KEY_LINE = re.compile(r"^(?P<indent>\s*)(?:-\s+)?[\"']?tools[\"']?\s*:(?:\s+(?P<rest>.*))?$")
ITEM_NAME = re.compile(r"^[\"']?(?:name|tool|id)[\"']?\s*:\s*(?P<value>.+)$")


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


def is_target(rel):
    return rel.startswith("config/agents/") and rel.endswith((".yaml", ".yml"))


def strip_comment(line):
    quote = None
    for i, ch in enumerate(line):
        if quote:
            if ch == quote:
                quote = None
        elif ch in ("'", '"'):
            quote = ch
        elif ch == "#" and (i == 0 or line[i - 1] in " \t"):
            return line[:i].rstrip()
    return line.rstrip()


def unquote(value):
    value = value.strip().rstrip(",").strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
        return value[1:-1]
    return value


def split_flow(inner):
    return [unquote(part) for part in inner.split(",") if part.strip()]


def extract_tools(text):
    """Return (tools, problems) for every `tools:` key in the document."""
    lines = [strip_comment(line) for line in text.splitlines()]
    tools, problems = [], []
    i = 0
    while i < len(lines):
        m = KEY_LINE.match(lines[i])
        if not m:
            i += 1
            continue
        key_indent = len(m.group("indent"))
        rest = (m.group("rest") or "").strip()
        i += 1
        if rest.startswith("["):
            buffer = rest
            while "]" not in buffer and i < len(lines):
                buffer += " " + lines[i].strip()
                i += 1
            inner = buffer[1:buffer.index("]")] if "]" in buffer else buffer[1:]
            tools.extend(split_flow(inner))
            continue
        if rest.startswith(("*", "&", "!")):
            problems.append("`tools:` uses an alias, anchor or tag (%s) that this hook cannot verify" % rest)
            continue
        if rest and rest not in ("|", ">"):
            tools.append(unquote(rest))
            continue
        # Block list: items indented deeper than the key, or at the same indent
        # starting with "- ".
        while i < len(lines):
            line = lines[i]
            if not line.strip():
                i += 1
                continue
            indent = len(line) - len(line.lstrip())
            stripped = line.strip()
            if indent < key_indent or (indent == key_indent and not stripped.startswith("-")):
                break
            if stripped.startswith("-"):
                item = stripped[1:].strip()
                name = ITEM_NAME.match(item)
                if name:
                    tools.append(unquote(name.group("value")))
                elif item.startswith("["):
                    tools.extend(split_flow(item.strip("[]")))
                elif item and ":" not in item:
                    tools.append(unquote(item))
                elif item.startswith(("*", "&")):
                    problems.append("a `tools:` item uses an alias or anchor (%s)" % item)
            else:
                name = ITEM_NAME.match(stripped)
                if name:
                    tools.append(unquote(name.group("value")))
            i += 1
    return tools, problems


def is_write_class(tool):
    name = tool.strip().lower()
    for write in WRITE_CLASS_TOOLS:
        if name == write:
            return write
        for sep in (".", "__", "/", ":"):
            if name.endswith(sep + write):
                return write
    return None


def proposed_content(tool_name, tool_input, abs_path):
    if tool_name == "Write":
        return tool_input.get("content") or ""
    if tool_name == "Edit":
        try:
            with open(abs_path, "r", encoding="utf-8") as handle:
                current = handle.read()
        except OSError:
            return None  # The Edit tool will fail on a missing file.
        old = tool_input.get("old_string") or ""
        new = tool_input.get("new_string") or ""
        if not old or old not in current:
            return None  # The Edit tool will fail; nothing to check.
        if tool_input.get("replace_all"):
            return current.replace(old, new)
        return current.replace(old, new, 1)
    return None


def main():
    raw = sys.stdin.read()
    try:
        data = json.loads(raw) if raw.strip() else {}
    except ValueError:
        block("hook input is not valid JSON, so the agent file could not be checked")
    if not isinstance(data, dict):
        block("hook input is not a JSON object, so the agent file could not be checked")
    tool_input = data.get("tool_input") or {}
    if not isinstance(tool_input, dict):
        sys.exit(0)
    file_path = tool_input.get("file_path") or ""
    root = project_dir(data)
    rels = relative_paths(file_path, root, data.get("cwd"))
    if not any(is_target(rel) for rel in rels):
        sys.exit(0)
    abs_path = file_path if os.path.isabs(file_path) else os.path.join(data.get("cwd") or root, file_path)
    content = proposed_content(data.get("tool_name") or "", tool_input, abs_path)
    if content is None:
        sys.exit(0)
    tools, problems = extract_tools(content)
    found = sorted({w for w in (is_write_class(t) for t in tools) if w})
    target = [rel for rel in rels if is_target(rel)][0]
    if found:
        block("%s would give a runtime agent write-class tool(s): %s" % (target, ", ".join(found)))
    if problems:
        block("%s: %s" % (target, "; ".join(problems)))
    sys.exit(0)


if __name__ == "__main__":
    main()
