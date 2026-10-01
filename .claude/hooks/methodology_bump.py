#!/usr/bin/env python3
"""methodology_bump: PreToolUse hook for Edit|Write on config/rules/*.yaml and
config/scoring.yaml.

Blocks a change to any weight (an `importance_weight:` value, a category
weight, or any value under a key whose name contains "weight") unless
`methodology_version:` also changes. Scores must stay recomputable: stored
rule results are re-scored with the methodology version they were produced
under.

How "changed" is decided:
- Baseline = the file at git HEAD when git is available and the file is
  tracked; otherwise the file on disk before this edit; otherwise empty.
- Weights: every leaf under a key containing "weight", compared baseline vs
  proposed. List items are identified by `id`, `rule_id`, `key`, `name` or
  `category` when present, else by position.
- Version: the proposed `methodology_version` must differ from the baseline's.
  A rules file without its own `methodology_version` passes only if
  config/scoring.yaml on disk already carries a version that differs from
  git HEAD (the bump is part of the same uncommitted change).

YAML is read with a small indentation-based parser (standard library only).

Exit 0 allows. Exit 2 blocks with the reason on stderr.

Sources: 02-DETAILED-SPECIFICATION section 6 (rule changes, recomputable
scores), 01-PRODUCT-REQUIREMENTS section 14 (methodology weights need
approval), v1-baseline section 6.2 (category weights).
"""
import json
import os
import re
import subprocess
import sys

HOOK = "methodology_bump"
ROUTE = (
    "Bump `methodology_version:` in the same change (in this file, or in "
    "config/scoring.yaml for rules files that do not carry their own version), "
    "record the reason in docs/decisions.md, and get the SEO lead (methodology "
    "owner) to approve the pull request. Weight changes are methodology decisions "
    "(01-PRODUCT-REQUIREMENTS section 14)."
)

SCORING_FILE = "config/scoring.yaml"
KEY_RE = re.compile(r"""^(?P<key>"[^"]*"|'[^']*'|[^\s"'\[\]{},#&*!|>%@`-][^:#]*?|-[^\s:#][^:#]*?)\s*:(?:\s+(?P<rest>.*)|$)""")
ID_KEYS = ("id", "rule_id", "key", "name", "category")


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
    if rel == SCORING_FILE:
        return True
    return rel.startswith("config/rules/") and rel.endswith((".yaml", ".yml"))


# ---------------------------------------------------------------- YAML subset

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
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
        return value[1:-1]
    return value


def split_top_level(inner):
    parts, depth, quote, current = [], 0, None, ""
    for ch in inner:
        if quote:
            current += ch
            if ch == quote:
                quote = None
            continue
        if ch in ("'", '"'):
            quote = ch
        elif ch in "[{":
            depth += 1
        elif ch in "]}":
            depth -= 1
        elif ch == "," and depth == 0:
            parts.append(current)
            current = ""
            continue
        current += ch
    if current.strip():
        parts.append(current)
    return [p.strip() for p in parts if p.strip()]


def parse_scalar(rest):
    rest = rest.strip()
    if rest.startswith("[") and rest.endswith("]"):
        return [parse_scalar(p) for p in split_top_level(rest[1:-1])]
    if rest.startswith("{") and rest.endswith("}"):
        result = {}
        for part in split_top_level(rest[1:-1]):
            m = KEY_RE.match(part)
            if m:
                result[unquote(m.group("key"))] = parse_scalar(m.group("rest") or "")
        return result
    return unquote(rest)


def prepare(text):
    lines = []
    for raw in text.splitlines():
        if raw.strip() in ("---", "..."):
            continue
        line = strip_comment(raw.replace("\t", "    "))
        if not line.strip():
            continue
        lines.append([len(line) - len(line.lstrip(" ")), line.strip()])
    return lines


def is_list_line(content):
    return content == "-" or content.startswith("- ")


def parse_node(lines, i, indent):
    if is_list_line(lines[i][1]):
        return parse_list(lines, i, indent)
    return parse_map(lines, i, indent)


def parse_map(lines, i, indent):
    result = {}
    while i < len(lines):
        line_indent, content = lines[i]
        if line_indent < indent or (line_indent == indent and is_list_line(content)):
            break
        if line_indent > indent:
            i += 1
            continue
        m = KEY_RE.match(content)
        if not m:
            i += 1
            continue
        key = unquote(m.group("key"))
        rest = (m.group("rest") or "").strip()
        if rest in ("|", ">", "|-", ">-", "|+", ">+"):
            j = i + 1
            while j < len(lines) and lines[j][0] > indent:
                j += 1
            result[key] = "<block scalar>"
            i = j
            continue
        if rest:
            result[key] = parse_scalar(rest)
            i += 1
            continue
        nxt = i + 1
        if nxt < len(lines) and (lines[nxt][0] > indent
                                 or (lines[nxt][0] == indent and is_list_line(lines[nxt][1]))):
            child, i = parse_node(lines, nxt, lines[nxt][0])
            result[key] = child
            continue
        result[key] = None
        i += 1
    return result, i


def parse_list(lines, i, indent):
    result = []
    while i < len(lines):
        line_indent, content = lines[i]
        if line_indent < indent:
            break
        if line_indent > indent:
            i += 1
            continue
        if not is_list_line(content):
            break
        item = content[1:].strip()
        if not item:
            nxt = i + 1
            if nxt < len(lines) and lines[nxt][0] > indent:
                child, i = parse_node(lines, nxt, lines[nxt][0])
                result.append(child)
                continue
            result.append(None)
            i += 1
            continue
        if KEY_RE.match(item) and not item.startswith(("[", "{", '"', "'")):
            sub_indent = indent + (len(content) - len(item))
            lines[i] = [sub_indent, item]
            child, i = parse_map(lines, i, sub_indent)
            result.append(child)
            continue
        if is_list_line(item):
            sub_indent = indent + (len(content) - len(item))
            lines[i] = [sub_indent, item]
            child, i = parse_list(lines, i, sub_indent)
            result.append(child)
            continue
        result.append(parse_scalar(item))
        i += 1
    return result, i


def parse_yaml(text):
    lines = prepare(text or "")
    if not lines:
        return {}
    try:
        node, _ = parse_node(lines, 0, lines[0][0])
        return node
    except (IndexError, RecursionError, ValueError):
        return {}


def normalize(value):
    if isinstance(value, (dict, list)):
        return json.dumps(value, sort_keys=True)
    if value is None:
        return "null"
    text = str(value).strip()
    try:
        return repr(float(text))
    except ValueError:
        return text


def flatten(node, path=()):
    if isinstance(node, dict):
        for key, value in node.items():
            yield from flatten(value, path + (("key", str(key)),))
    elif isinstance(node, list):
        for index, value in enumerate(node):
            ident = "#%d" % index
            if isinstance(value, dict):
                for id_key in ID_KEYS:
                    if isinstance(value.get(id_key), str):
                        ident = "%s=%s" % (id_key, value[id_key])
                        break
            yield from flatten(value, path + (("item", ident),))
    else:
        yield path, node


def path_text(path):
    return ".".join(v if kind == "key" else "[%s]" % v for kind, v in path)


def weights(node):
    found = {}
    for path, value in flatten(node):
        if any(kind == "key" and "weight" in value_.lower() for kind, value_ in path):
            found[path_text(path)] = normalize(value)
    return found


def version(node):
    best = None
    for path, value in flatten(node):
        if path and path[-1] == ("key", "methodology_version"):
            if best is None or len(path) < best[0]:
                best = (len(path), normalize(value))
    return best[1] if best else None


# ------------------------------------------------------------------ baseline

def git_head_content(root, rel):
    try:
        result = subprocess.run(
            ["git", "-C", root, "show", "HEAD:./" + rel],
            capture_output=True, timeout=10,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if result.returncode != 0:
        return None
    return result.stdout.decode("utf-8", errors="replace")


def read_file(path):
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return handle.read()
    except OSError:
        return None


def proposed_content(tool_name, tool_input, current):
    if tool_name == "Write":
        return tool_input.get("content") or ""
    if tool_name == "Edit":
        if current is None:
            return None
        old = tool_input.get("old_string") or ""
        new = tool_input.get("new_string") or ""
        if not old or old not in current:
            return None
        if tool_input.get("replace_all"):
            return current.replace(old, new)
        return current.replace(old, new, 1)
    return None


def scoring_version_bumped(root):
    head = git_head_content(root, SCORING_FILE)
    disk = read_file(os.path.join(root, SCORING_FILE))
    if head is None or disk is None:
        return False
    head_version, disk_version = version(parse_yaml(head)), version(parse_yaml(disk))
    return disk_version is not None and disk_version != head_version


def main():
    raw = sys.stdin.read()
    try:
        data = json.loads(raw) if raw.strip() else {}
    except ValueError:
        block("hook input is not valid JSON, so the methodology file could not be checked")
    if not isinstance(data, dict):
        block("hook input is not a JSON object, so the methodology file could not be checked")
    tool_input = data.get("tool_input") or {}
    if not isinstance(tool_input, dict):
        sys.exit(0)
    file_path = tool_input.get("file_path") or ""
    root = project_dir(data)
    rels = relative_paths(file_path, root, data.get("cwd"))
    targets = [rel for rel in rels if is_target(rel)]
    if not targets:
        sys.exit(0)
    rel = targets[0]
    abs_path = file_path if os.path.isabs(file_path) else os.path.join(data.get("cwd") or root, file_path)
    current = read_file(abs_path)
    proposed = proposed_content(data.get("tool_name") or "", tool_input, current)
    if proposed is None:
        sys.exit(0)
    head = git_head_content(root, rel)
    baseline_text = head if head is not None else (current or "")
    baseline, new = parse_yaml(baseline_text), parse_yaml(proposed)

    old_weights, new_weights = weights(baseline), weights(new)
    if old_weights == new_weights:
        sys.exit(0)
    changed = sorted(k for k in set(old_weights) | set(new_weights)
                     if old_weights.get(k) != new_weights.get(k))

    old_version, new_version = version(baseline), version(new)
    if new_version is not None and new_version != old_version:
        sys.exit(0)
    if old_version is None and new_version is None and rel != SCORING_FILE:
        if scoring_version_bumped(root):
            sys.exit(0)
        block("%s changes weights (%s) but neither this file nor %s bumps "
              "methodology_version" % (rel, ", ".join(changed[:5]), SCORING_FILE))
    block("%s changes weights (%s) without changing methodology_version (still %s)"
          % (rel, ", ".join(changed[:5]), new_version))


if __name__ == "__main__":
    main()
