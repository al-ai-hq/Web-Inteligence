#!/usr/bin/env python3
"""Validate the WPI configuration under config/.

Owner role: AI engineer and methodology owner (files under config/).
Sources: config file headers; docs/decisions.md D-002, D-003, D-005, D-006, D-007, D-010, D-011, D-012.
Status: draft for review.

Checks:
  - every YAML file under config/ parses and starts with the required comment header;
  - scoring category weights sum to 100 and match the canonical categories;
  - rule IDs are unique, match the v1-baseline plus 02-DETAILED-SPECIFICATION §6 catalog, weights are 1-5
    (0 only for scored: false), categories are known;
  - every agent file has exactly the allowed keys and no write-class tool in `tools`;
  - anonymous retention is at most 7 days and the registered default is 30 days;
  - the monthly budget cap is 150 USD and per-audit caps are 3.00 and 4.00;
  - no string looks like a real model ID (for example starts with "claude-", "gemini-", "gpt-");
  - providers, crawler registry, policy facts, schema requirements, prompt templates, connectors and
    anonymous eligibility are internally consistent.

Usage: python3 scripts/check_config.py   (from the repository root or anywhere)
Exit code: 0 when every check passes, 1 when any check fails, 2 when PyYAML is missing.
"""
from __future__ import annotations

import re
import sys
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover
    print("PyYAML is missing. Install it with: pip install --break-system-packages pyyaml")
    sys.exit(2)

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "config"

METHODOLOGY_VERSION = "0.1.0-draft"

CATEGORIES = {
    "crawlability": 20,
    "on_page": 15,
    "structured_data": 10,
    "aeo": 20,
    "geo": 15,
    "i18n_accessibility": 10,
    "performance_security": 10,
}

# v1-baseline §7 catalog plus the 02-DETAILED-SPECIFICATION §6 additions. No other IDs are allowed.
EXPECTED_RULES = {
    "crawlability": [f"CRW-{i:03d}" for i in range(1, 13)] + ["GSC-001", "GSC-002", "GSC-003"],
    "on_page": [f"SEO-{i:03d}" for i in range(1, 13)] + ["SPAM-001"],
    "structured_data": [f"STR-{i:03d}" for i in range(1, 9)],
    "aeo": [f"AEO-{i:03d}" for i in range(1, 12)],
    "geo": [f"GEO-{i:03d}" for i in range(1, 12)],
    "i18n_accessibility": [f"I18N-{i:03d}" for i in range(1, 5)]
    + [f"A11Y-{i:03d}" for i in range(1, 5)]
    + ["MOB-001", "AGT-001", "AGT-002"],
    "performance_security": [f"PRF-{i:03d}" for i in range(1, 5)]
    + [f"SEC-{i:03d}" for i in range(1, 4)]
    + ["DEL-001"],
}
EXPECTED_UNSCORED = {"GSC-003", "GEO-010", "SPAM-001", "AGT-002"}
EXPECTED_CONNECTED_ONLY = {"GSC-001", "GSC-002", "GSC-003"}
RULE_KEYS = [
    "id", "title", "category", "importance_weight", "scored", "connected_tier_only",
    "applicability", "standards", "evaluation", "fidelity_label", "change", "source_reference",
]
FIDELITY_LABELS = {"observed", "computed", "assessed", "attested", "user_supplied", "estimated", "unavailable"}

WRITE_CLASS_TOOLS = {
    "apply_change", "publish", "write_cms", "delete_content", "upload_disavow", "send_email", "submit_form",
}
CORE_AGENT_TOOLS = {
    "auditor": ["get_evidence", "eval_rule", "validate_schema", "psi_query", "crux_query", "gsc_query"],
    "visibility-tester": ["analyze_response", "match_entity", "normalize_citation", "check_brand_facts"],
    "keyword-analyst": ["import_keywords", "gsc_query", "cluster_keywords", "map_keywords", "check_cannibalization"],
    "performance-analyst": ["gsc_query", "ga4_query", "calc_metrics", "segment_change", "get_calendar_events"],
    "planner": ["calc_priority", "build_plan"],
    "content-strategist": ["find_opportunities", "write_brief", "draft_article"],
    "fixer": ["read_cms_fields", "draft_change_set"],
    "verifier": ["refetch", "eval_rule", "gsc_inspect", "request_rollback"],
    "report-writer": ["render_report", "translate"],
}
LATER_AGENTS = {
    "intake-coordinator", "commerce-analyst", "local-analyst", "entity-analyst", "architecture-strategist",
    "backlink-analyst", "comparison-reviewer", "programmatic-governor", "change-monitor",
}
AGENT_KEYS = {"name", "milestone", "reads_untrusted_content", "model_tier", "tools", "forbidden_tools"}

CRAWLER_TOKENS = {
    "Googlebot", "Google-Extended", "Google-Agent", "Bingbot", "GPTBot", "OAI-SearchBot", "ChatGPT-User",
    "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User", "Applebot-Extended",
    "CCBot", "Bytespider", "meta-externalagent",
}
CRAWLER_PURPOSES = {"search", "training", "user_requested", "control_token"}
ROBOTS_VALUES = {"yes", "generally_ignored", "may_not_apply", "varies", "unknown"}

PROVIDER_IDS = {"gemini", "claude", "openai", "perplexity", "grok"}

# Case-sensitive: real model IDs are lowercase ("claude-...", "gemini-..."); crawler tokens such as
# "Claude-User" are capitalized and are not model IDs.
MODEL_ID_RE = re.compile(r"^(claude|gemini|gpt|grok|sonar|chatgpt)-[A-Za-z0-9]")
HEADER_FIELDS = ["Purpose:", "Owner role:", "Source sections:", "Status:"]
DURATION_RE = re.compile(
    r"^P(?:(?P<y>\d+)Y)?(?:(?P<mo>\d+)M)?(?:(?P<w>\d+)W)?(?:(?P<d>\d+)D)?"
    r"(?:T(?:(?P<h>\d+)H)?(?:(?P<mi>\d+)M)?(?:(?P<s>\d+)S)?)?$"
)
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

errors: list[str] = []
checks_run = 0


def check(condition: bool, message: str) -> bool:
    global checks_run
    checks_run += 1
    if not condition:
        errors.append(message)
    return condition


def rel(path: Path) -> str:
    return str(path.relative_to(ROOT))


def duration_hours(value) -> float | None:
    """Upper-bound length of an ISO 8601 duration in hours (Y=366 d, M=31 d); None if not a duration."""
    if not isinstance(value, str):
        return None
    m = DURATION_RE.match(value)
    if not m or value in ("P", "PT"):
        return None
    g = {k: int(v) if v else 0 for k, v in m.groupdict().items()}
    days = g["y"] * 366 + g["mo"] * 31 + g["w"] * 7 + g["d"]
    return days * 24 + g["h"] + g["mi"] / 60 + g["s"] / 3600


def parse_date(value) -> date | None:
    if isinstance(value, date):
        return value
    if isinstance(value, str) and DATE_RE.match(value):
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None
    return None


def is_placeholder(value, prefix: str = "<DECIDE_AT_M0") -> bool:
    return isinstance(value, str) and value.startswith(prefix)


def walk(node, path="$"):
    """Yield (path, key_or_None, value) for every scalar and key in a parsed YAML tree."""
    if isinstance(node, dict):
        for k, v in node.items():
            yield f"{path}.{k}", k, None
            yield from walk(v, f"{path}.{k}")
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from walk(v, f"{path}[{i}]")
    else:
        yield path, None, node


# ---------------------------------------------------------------------------------------------
# Loading and generic checks
# ---------------------------------------------------------------------------------------------

def load_config() -> dict[Path, object]:
    docs: dict[Path, object] = {}
    files = sorted(list(CONFIG.rglob("*.yaml")) + list(CONFIG.rglob("*.yml")))
    check(bool(files), f"no YAML files found under {CONFIG}")
    for path in files:
        text = path.read_text(encoding="utf-8")
        lines = text.splitlines()
        header = []
        for line in lines:
            if line.startswith("#"):
                header.append(line)
            else:
                break
        check(bool(lines) and lines[0].startswith("# Purpose:"),
              f"{rel(path)}: first line must be the '# Purpose:' header comment")
        header_text = "\n".join(header)
        for field in HEADER_FIELDS:
            check(field in header_text, f"{rel(path)}: header comment is missing '{field}'")
        try:
            data = yaml.safe_load(text)
        except yaml.YAMLError as exc:
            check(False, f"{rel(path)}: YAML does not parse: {exc}")
            continue
        check(isinstance(data, dict), f"{rel(path)}: top level must be a mapping")
        docs[path] = data
    return docs


def iter_pairs(node, path="$"):
    """Yield (path, key, value) for every mapping entry in a parsed YAML tree."""
    if isinstance(node, dict):
        for k, v in node.items():
            yield f"{path}.{k}", k, v
            yield from iter_pairs(v, f"{path}.{k}")
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from iter_pairs(v, f"{path}[{i}]")


def check_no_model_ids_or_prices(docs: dict[Path, object]) -> None:
    """YAML comments are not parsed, so only keys and values are scanned ("outside comments")."""
    for path, data in docs.items():
        model_hits, price_hits = [], []
        for where, key, value in walk(data):
            text = key if key is not None else value
            if not isinstance(text, str):
                continue
            for token in text.split():
                if "://" in token or token.startswith("www."):
                    continue
                token = token.strip("\"'()[]{},;:.!?")
                if MODEL_ID_RE.match(token):
                    model_hits.append(f"{where}: '{token}'")
        for where, key, value in iter_pairs(data):
            if "price" in str(key).lower() and isinstance(value, (int, float)) and not isinstance(value, bool):
                price_hits.append(where)
        check(not model_hits, f"{rel(path)}: strings that look like model IDs (use a <DECIDE_AT_M0> placeholder): {model_hits}")
        check(not price_hits, f"{rel(path)}: numeric prices found; prices never live in config (D-010): {price_hits}")


# ---------------------------------------------------------------------------------------------
# File-specific checks
# ---------------------------------------------------------------------------------------------

def check_scoring(docs) -> dict:
    path = CONFIG / "scoring.yaml"
    data = docs.get(path)
    if not check(isinstance(data, dict), "config/scoring.yaml is missing or unreadable"):
        return {}
    check(data.get("methodology_version") == METHODOLOGY_VERSION,
          f"scoring.yaml: methodology_version must be {METHODOLOGY_VERSION!r}")
    cats = data.get("categories") or {}
    check(set(cats) == set(CATEGORIES),
          f"scoring.yaml: categories must be exactly {sorted(CATEGORIES)}; found {sorted(cats)}")
    total = 0
    for name, spec in cats.items():
        weight = (spec or {}).get("weight")
        check(isinstance(weight, int), f"scoring.yaml: category {name} weight must be an integer")
        if isinstance(weight, int):
            total += weight
        check(weight == CATEGORIES.get(name),
              f"scoring.yaml: category {name} weight {weight} differs from v1-baseline §6.2 ({CATEGORIES.get(name)})")
        rules_file = (spec or {}).get("rules_file")
        check(isinstance(rules_file, str) and (ROOT / rules_file).is_file(),
              f"scoring.yaml: category {name} rules_file {rules_file!r} does not exist")
    check(total == 100, f"scoring.yaml: category weights sum to {total}, expected 100")

    results = data.get("rule_results") or {}
    expected_values = {"pass": 1.0, "partial": 0.5, "fail": 0.0}
    for key, val in expected_values.items():
        check((results.get(key) or {}).get("value") == val, f"scoring.yaml: rule_results.{key}.value must be {val}")
    for key in ("not_applicable", "unavailable", "error"):
        check((results.get(key) or {}).get("in_denominator") is False,
              f"scoring.yaml: rule_results.{key} must be excluded from the denominator")

    caps = {c.get("id"): c for c in data.get("critical_caps") or [] if isinstance(c, dict)}
    for cap_id, value in {"homepage_unretrievable": 20, "sitewide_noindex": 25, "robots_blocks_general_search": 30,
                          "empty_main_content": 45, "https_unavailable": 60, "spam_policy_confirmed": 50}.items():
        check(cap_id in caps and caps[cap_id].get("max_overall_score") == value,
              f"scoring.yaml: critical cap {cap_id} must exist with max_overall_score {value}")
    check("unsafe_canonical_domain" in caps, "scoring.yaml: the unsafe-domain security rejection must be listed")

    blend = set(((data.get("separation") or {}).get("never_blend")) or [])
    check(blend == {"presence_readiness", "experience_effectiveness", "ai_visibility", "search_performance"},
          "scoring.yaml: separation.never_blend must list the four separate measurements")
    conf = ((data.get("priority") or {}).get("inputs") or {}).get("confidence_factor") or {}
    check(conf == {"high": 1.0, "medium": 0.75, "low": 0.5},
          "scoring.yaml: priority confidence_factor must be high 1.0, medium 0.75, low 0.5")
    return caps


def check_rules(docs, caps) -> dict[str, int]:
    rules_dir = CONFIG / "rules"
    seen: dict[str, str] = {}
    counts: dict[str, int] = {}
    unscored, connected_only = set(), set()
    files = sorted(rules_dir.glob("*.yaml"))
    check(len(files) == len(CATEGORIES), f"config/rules/: expected {len(CATEGORIES)} files, found {len(files)}")
    for path in files:
        data = docs.get(path)
        if not isinstance(data, dict):
            continue
        cat = data.get("category")
        check(cat in CATEGORIES, f"{rel(path)}: unknown category {cat!r}")
        check(path.stem == str(cat).replace("_", "-"), f"{rel(path)}: file name must be the kebab-case category")
        check(data.get("category_weight") == CATEGORIES.get(cat),
              f"{rel(path)}: category_weight must match scoring.yaml")
        check(data.get("methodology_version") == METHODOLOGY_VERSION,
              f"{rel(path)}: methodology_version must be {METHODOLOGY_VERSION!r}")
        ids_in_file = []
        for rule in data.get("rules") or []:
            if not check(isinstance(rule, dict), f"{rel(path)}: every rule must be a mapping"):
                continue
            rid = rule.get("id")
            where = f"{rel(path)} {rid}"
            for key in RULE_KEYS:
                check(key in rule, f"{where}: missing key {key!r}")
            check(isinstance(rid, str) and re.match(r"^[A-Z0-9]+-\d{3}$", rid or "") is not None,
                  f"{where}: invalid rule id")
            check(rid not in seen, f"{where}: duplicate rule id (also in {seen.get(rid)})")
            seen[rid] = rel(path)
            ids_in_file.append(rid)
            check(rule.get("category") == cat, f"{where}: category {rule.get('category')!r} differs from file category")
            scored = rule.get("scored")
            weight = rule.get("importance_weight")
            check(isinstance(scored, bool), f"{where}: scored must be true or false")
            if scored:
                check(isinstance(weight, int) and not isinstance(weight, bool) and 1 <= weight <= 5,
                      f"{where}: importance_weight must be an integer 1-5 for a scored rule")
                standards = rule.get("standards") or {}
                for key in ("pass", "partial", "fail"):
                    check(isinstance(standards.get(key), str) and standards.get(key),
                          f"{where}: scored rule needs standards.{key}")
            else:
                unscored.add(rid)
                check(weight == 0, f"{where}: an unscored rule must have importance_weight 0")
                standards = rule.get("standards") or {}
                check(bool(standards.get("pass") or standards.get("report")),
                      f"{where}: unscored rule needs standards.pass or standards.report")
            if rule.get("connected_tier_only") is True:
                connected_only.add(rid)
            check(rule.get("evaluation") in {"deterministic", "assessed"},
                  f"{where}: evaluation must be deterministic or assessed")
            check(rule.get("fidelity_label") in FIDELITY_LABELS, f"{where}: unknown fidelity_label")
            check(rule.get("change") in {"unchanged", "modified", "new"}, f"{where}: change must be unchanged, modified or new")
            if rule.get("change") == "modified":
                check(isinstance(rule.get("v1"), dict), f"{where}: modified rule must record its v1 values")
            refs = rule.get("source_reference")
            check(isinstance(refs, list) and len(refs) > 0, f"{where}: source_reference must be a non-empty list")
            cap = rule.get("critical_cap")
            if cap is not None:
                check(cap in caps, f"{where}: critical_cap {cap!r} is not defined in scoring.yaml")
        counts[cat] = len(ids_in_file)
        expected = EXPECTED_RULES.get(cat, [])
        check(sorted(ids_in_file) == sorted(expected),
              f"{rel(path)}: rule IDs differ from the catalog; missing {sorted(set(expected) - set(ids_in_file))}, "
              f"unexpected {sorted(set(ids_in_file) - set(expected))}")
    check(unscored == EXPECTED_UNSCORED, f"rules: unscored set {sorted(unscored)} != {sorted(EXPECTED_UNSCORED)}")
    check(connected_only == EXPECTED_CONNECTED_ONLY,
          f"rules: connected_tier_only set {sorted(connected_only)} != {sorted(EXPECTED_CONNECTED_ONLY)}")
    return counts


def check_agents(docs) -> None:
    agents_dir = CONFIG / "agents"
    found = set()
    for path in sorted(agents_dir.glob("*.yaml")):
        data = docs.get(path)
        if not isinstance(data, dict):
            continue
        name = data.get("name")
        found.add(path.stem)
        where = rel(path)
        is_later = path.stem in LATER_AGENTS
        allowed = AGENT_KEYS | ({"status"} if is_later else set())
        check(set(data) == allowed,
              f"{where}: keys must be exactly {sorted(allowed)}; found {sorted(data)}")
        check(name == path.stem, f"{where}: name {name!r} must equal the file name")
        check(path.stem in CORE_AGENT_TOOLS or is_later, f"{where}: {path.stem!r} is not in the agent vocabulary")
        check(isinstance(data.get("milestone"), str) and re.match(r"^M\d+[A-Z]?$", data.get("milestone") or ""),
              f"{where}: milestone must look like M2 or M8A")
        check(isinstance(data.get("reads_untrusted_content"), bool), f"{where}: reads_untrusted_content must be a boolean")
        check(isinstance(data.get("model_tier"), str) and data.get("model_tier"), f"{where}: model_tier must be a string")
        tools = data.get("tools")
        forbidden = data.get("forbidden_tools")
        check(isinstance(tools, list) and tools and all(isinstance(t, str) for t in tools),
              f"{where}: tools must be a non-empty list of strings")
        check(isinstance(forbidden, list) and all(isinstance(t, str) for t in forbidden),
              f"{where}: forbidden_tools must be a list of strings")
        tools = tools if isinstance(tools, list) else []
        forbidden = forbidden if isinstance(forbidden, list) else []
        for tool in tools:
            check(re.match(r"^[a-z][a-z0-9_]*$", tool or "") is not None, f"{where}: tool {tool!r} is not snake_case")
        bad = WRITE_CLASS_TOOLS & set(tools)
        check(not bad, f"{where}: write-class tools in tools: {sorted(bad)}")
        check(WRITE_CLASS_TOOLS <= set(forbidden),
              f"{where}: forbidden_tools must include every write-class tool; missing {sorted(WRITE_CLASS_TOOLS - set(forbidden))}")
        check(not (set(tools) & set(forbidden)), f"{where}: a tool is both allowed and forbidden")
        if is_later:
            check(data.get("status") == "draft", f"{where}: later-milestone agents must have status: draft")
        else:
            check(tools == CORE_AGENT_TOOLS.get(path.stem),
                  f"{where}: tools must be exactly {CORE_AGENT_TOOLS.get(path.stem)} (02-DETAILED-SPECIFICATION §13)")
    expected = set(CORE_AGENT_TOOLS) | LATER_AGENTS
    check(found == expected, f"config/agents/: missing {sorted(expected - found)}, unexpected {sorted(found - expected)}")


def check_retention(docs) -> None:
    data = docs.get(CONFIG / "retention.yaml")
    if not check(isinstance(data, dict), "config/retention.yaml is missing or unreadable"):
        return
    seven_days = 7 * 24
    anon = data.get("anonymous") or {}
    max_h = duration_hours(anon.get("max_retention"))
    check(max_h is not None and max_h <= seven_days, "retention.yaml: anonymous.max_retention must be a duration <= P7D")
    check(anon.get("exports") == "none", "retention.yaml: anonymous exports must be 'none' (D-002)")
    for item in anon.get("items") or []:
        hours = duration_hours(item.get("retention"))
        check(hours is not None and hours <= seven_days,
              f"retention.yaml: anonymous item {item.get('id')} retention {item.get('retention')!r} must be a duration <= P7D")
    reg = data.get("registered") or {}
    check(reg.get("default_evidence_retention") == "P30D",
          "retention.yaml: registered.default_evidence_retention must be P30D (D-003)")
    for item in reg.get("items") or []:
        if item.get("id") in {"registered_evidence_and_findings", "registered_llm_prompts_and_responses",
                              "registered_web_report", "registered_exports"}:
            hours = duration_hours(item.get("retention"))
            check(hours is not None and hours <= 30 * 24,
                  f"retention.yaml: registered item {item.get('id')} must not exceed P30D")


def check_budgets(docs) -> None:
    data = docs.get(CONFIG / "budgets.yaml")
    if not check(isinstance(data, dict), "config/budgets.yaml is missing or unreadable"):
        return

    def dec(value):
        try:
            return Decimal(str(value)) if isinstance(value, str) else None
        except InvalidOperation:
            return None

    check(data.get("currency") == "USD", "budgets.yaml: currency must be USD")
    monthly = data.get("monthly") or {}
    check(dec(monthly.get("hard_cap")) == Decimal("150"), "budgets.yaml: monthly.hard_cap must be the decimal string '150.00' (D-005)")
    check(monthly.get("scope") == "combined_hosting_and_paid_calls", "budgets.yaml: the cap covers hosting and paid calls (D-005)")
    per = data.get("per_audit") or {}
    soft, hard = dec(per.get("soft_cap")), dec(per.get("hard_cap"))
    check(soft == Decimal("3.00") and hard == Decimal("4.00"), "budgets.yaml: per-audit caps must be 3.00 and 4.00 (D-007)")
    for alert in data.get("alerts") or []:
        threshold = dec(alert.get("threshold"))
        check(threshold is not None and threshold < Decimal("150"), "budgets.yaml: alert thresholds must be below the cap")
    lines = {line.get("id") for line in ((data.get("tracked_lines") or {}).get("lines") or [])}
    check({"hosting_infrastructure", "paid_model_calls"} <= lines, "budgets.yaml: hosting and paid calls must be separate tracked lines")
    steps = [s for s in ((data.get("degradation_order") or {}).get("steps") or []) if isinstance(s, dict) and "step" in s]
    percents = [s.get("at_percent_of_cap") if "at_percent_of_cap" in s else s.get("at") for s in steps]
    check(percents == [70, 85, 95, "cap_minus_reserve"],
          f"budgets.yaml: degradation thresholds must be 70, 85, 95 and cap_minus_reserve; found {percents}")
    monthly = data.get("monthly") or {}
    check(monthly.get("paid_calls_stop_at") == "cap_minus_reserve" and dec(monthly.get("reserve")) is not None,
          "budgets.yaml: monthly.reserve must be set and paid calls must stop at cap_minus_reserve (one hard-stop threshold)")
    breaker = data.get("circuit_breaker") or {}
    check(breaker.get("open_after_consecutive_failures") == 3 and breaker.get("cool_down") == "PT15M"
          and breaker.get("probe_requests") == 1, "budgets.yaml: circuit breaker must be 3 failures, PT15M, 1 probe (D-007)")


def check_providers(docs) -> None:
    data = docs.get(CONFIG / "providers.yaml")
    if not check(isinstance(data, dict), "config/providers.yaml is missing or unreadable"):
        return
    ids = set()
    for prov in data.get("providers") or []:
        pid = prov.get("id")
        ids.add(pid)
        where = f"providers.yaml {pid}"
        for key in ("access_route", "model_id", "region", "price_table_version", "web_search",
                    "data_classes_allowed", "enabled_by_default"):
            check(key in prov, f"{where}: missing {key}")
        check(is_placeholder(prov.get("model_id")), f"{where}: model_id must be a <DECIDE_AT_M0> placeholder")
        check(is_placeholder(prov.get("price_table_version")), f"{where}: price_table_version must be a <DECIDE_AT_M0> placeholder")
        check(isinstance(prov.get("enabled_by_default"), bool), f"{where}: enabled_by_default must be a boolean")
        url = (prov.get("web_search") or {}).get("source_url")
        check(isinstance(url, str) and url.startswith("https://"), f"{where}: web_search.source_url must be an https URL")
        check(isinstance(prov.get("data_classes_allowed"), list), f"{where}: data_classes_allowed must be a list")
    check(PROVIDER_IDS <= ids, f"providers.yaml: missing provider families {sorted(PROVIDER_IDS - ids)}")
    for tier, spec in (data.get("agent_model_tiers") or {}).items():
        if isinstance(spec, dict) and "model_id" in spec:
            check(is_placeholder(spec["model_id"]), f"providers.yaml agent_model_tiers.{tier}: model_id must be a placeholder")


def check_crawlers(docs) -> None:
    data = docs.get(CONFIG / "crawler-registry.yaml")
    if not check(isinstance(data, dict), "config/crawler-registry.yaml is missing or unreadable"):
        return
    tokens = []
    for entry in data.get("crawlers") or []:
        token = entry.get("token")
        tokens.append(token)
        where = f"crawler-registry.yaml {token}"
        for key in ("operator", "purpose", "follows_robots_txt", "doc_url", "last_checked", "verification"):
            check(key in entry, f"{where}: missing {key}")
        check(entry.get("purpose") in CRAWLER_PURPOSES, f"{where}: purpose must be one of {sorted(CRAWLER_PURPOSES)}")
        check(entry.get("follows_robots_txt") in ROBOTS_VALUES, f"{where}: follows_robots_txt must be one of {sorted(ROBOTS_VALUES)}")
        doc = entry.get("doc_url")
        check(doc == "<confirm>" or (isinstance(doc, str) and doc.startswith("https://")),
              f"{where}: doc_url must be an https URL or '<confirm>'")
        if doc == "<confirm>":
            check(entry.get("last_checked") is None, f"{where}: last_checked must be null without a verified doc_url")
            check(entry.get("verification") == "needs_review", f"{where}: an entry without doc_url needs verification: needs_review")
        else:
            check(parse_date(entry.get("last_checked")) is not None, f"{where}: last_checked must be an ISO date")
    check(len(tokens) == len(set(tokens)), "crawler-registry.yaml: duplicate tokens")
    check(set(tokens) == CRAWLER_TOKENS,
          f"crawler-registry.yaml: tokens differ from 02-DETAILED-SPECIFICATION §6; missing {sorted(CRAWLER_TOKENS - set(tokens))}, "
          f"unexpected {sorted(set(tokens) - CRAWLER_TOKENS)}")


def check_policy_facts(docs) -> None:
    data = docs.get(CONFIG / "policy-facts.yaml")
    if not check(isinstance(data, dict), "config/policy-facts.yaml is missing or unreadable"):
        return
    ids = set()
    for fact in data.get("facts") or []:
        fid = fact.get("id")
        where = f"policy-facts.yaml {fid}"
        check(fid not in ids, f"{where}: duplicate id")
        ids.add(fid)
        for key in ("statement", "source_url", "source_tier", "checked_on", "owner_role", "review_by", "expires_on", "status"):
            check(key in fact, f"{where}: missing {key}")
        check(fact.get("status") in {"verified_in_library", "needs_verification"}, f"{where}: unknown status")
        check(fact.get("source_tier") in {1, 2, 3}, f"{where}: source_tier must be 1, 2 or 3")
        review, expires = parse_date(fact.get("review_by")), parse_date(fact.get("expires_on"))
        check(review is not None and expires is not None and review <= expires, f"{where}: review_by must be a date on or before expires_on")
        if fact.get("source_url") == "<confirm>":
            check(fact.get("status") == "needs_verification" and fact.get("checked_on") is None,
                  f"{where}: a fact without a verified source must be needs_verification with checked_on null")
        else:
            checked = parse_date(fact.get("checked_on"))
            check(isinstance(fact.get("source_url"), str) and fact["source_url"].startswith("https://"),
                  f"{where}: source_url must be an https URL or '<confirm>'")
            check(checked is not None and (review is None or checked <= review), f"{where}: checked_on must be a date on or before review_by")


def check_schema_requirements(docs) -> None:
    data = docs.get(CONFIG / "schema-requirements.yaml")
    if not check(isinstance(data, dict), "config/schema-requirements.yaml is missing or unreadable"):
        return
    types = []
    for entry in data.get("types") or []:
        name = entry.get("type")
        types.append(name)
        where = f"schema-requirements.yaml {name}"
        for key in ("checked_by", "google_doc_url", "required_properties", "recommended_properties"):
            check(key in entry, f"{where}: missing {key}")
        if not entry.get("required_properties") and not entry.get("recommended_properties"):
            check(entry.get("to_verify_at_m0b") is True, f"{where}: empty property lists need to_verify_at_m0b: true")
        url = entry.get("google_doc_url")
        check(url is None or (isinstance(url, str) and url.startswith("https://developers.google.com/")),
              f"{where}: google_doc_url must be null or a Google documentation URL")
    check(len(types) == len(set(types)), "schema-requirements.yaml: duplicate types")
    faq = next((t for t in data.get("types") or [] if t.get("type") == "FAQPage"), None)
    check(faq is not None and bool(faq.get("google_doc_url")) and "7 May 2026" in str(faq.get("rich_result_status")),
          "schema-requirements.yaml: FAQPage must carry its doc URL and the 7 May 2026 rich-result note")


def check_prompts(docs) -> None:
    tdir = CONFIG / "prompt-panels" / "templates"
    en, ar = docs.get(tdir / "en.yaml"), docs.get(tdir / "ar.yaml")
    if not (check(isinstance(en, dict), "templates/en.yaml missing") and check(isinstance(ar, dict), "templates/ar.yaml missing")):
        return
    placeholder_re = re.compile(r"\{([a-z_]+)\}")
    known = set((en.get("placeholders") or {}).keys())

    def index(doc, lang):
        out = {}
        for tpl in doc.get("templates") or []:
            tid = tpl.get("id")
            where = f"templates/{lang}.yaml {tid}"
            check(tid not in out, f"{where}: duplicate id")
            used = set(placeholder_re.findall(tpl.get("text") or ""))
            declared = set(tpl.get("placeholders") or [])
            check(used == declared, f"{where}: placeholders in text {sorted(used)} != declared {sorted(declared)}")
            check(declared <= known, f"{where}: unknown placeholders {sorted(declared - known)}")
            if tpl.get("branded") is False:
                check("brand" not in used, f"{where}: an unbranded template must not contain {{brand}}")
            if lang == "ar":
                check(tpl.get("needs_native_review") is True, f"{where}: every Arabic template needs needs_native_review: true")
            out[tid] = tpl
        return out

    en_idx, ar_idx = index(en, "en"), index(ar, "ar")
    check(set(en_idx) == set(ar_idx), f"templates: ids differ between en and ar: {sorted(set(en_idx) ^ set(ar_idx))}")
    for tid in set(en_idx) & set(ar_idx):
        check(set(en_idx[tid].get("placeholders") or []) == set(ar_idx[tid].get("placeholders") or []),
              f"templates {tid}: en and ar placeholders differ")
    check(ar.get("register") == "msa", "templates/ar.yaml: register must be msa")

    free = docs.get(CONFIG / "prompt-panels" / "free-panel.yaml")
    if check(isinstance(free, dict), "prompt-panels/free-panel.yaml missing"):
        total = 0
        for group, spec in (free.get("groups") or {}).items():
            ids = spec.get("template_ids") or []
            check(len(ids) == spec.get("count"), f"free-panel.yaml {group}: count differs from template_ids")
            total += len(ids)
            for tid in ids:
                check(tid in en_idx and en_idx[tid].get("panel") == "free", f"free-panel.yaml {group}: unknown free template {tid}")
        check(total == (free.get("size") or {}).get("prompts") == 8, "free-panel.yaml: 8 prompts expected (v1-baseline §8.3)")
        check((free.get("size") or {}).get("runs_per_prompt") == 1, "free-panel.yaml: one run per prompt (D-006)")
        check((free.get("display") or {}).get("mode") == "counts", "free-panel.yaml: free panel is shown as counts (D-006)")
    conn = docs.get(CONFIG / "prompt-panels" / "connected-panel.yaml")
    if check(isinstance(conn, dict), "prompt-panels/connected-panel.yaml missing"):
        cats = set((conn.get("categories") or {}).keys())
        check(cats == {"recommendation", "comparison", "how_to_choose", "price", "local", "brand_facts"},
              "connected-panel.yaml: the six 02-DETAILED-SPECIFICATION §6 categories are expected")
        for tid, tpl in en_idx.items():
            if tpl.get("panel") == "connected":
                check(tpl.get("category") in cats, f"templates {tid}: unknown connected category")


def check_connectors(docs) -> None:
    cdir = CONFIG / "connectors"
    names = {p.stem for p in cdir.glob("*.yaml")}
    check({"wordpress", "webflow", "shopify", "github"} <= names, "config/connectors/: wordpress, webflow, shopify and github are required")
    for path in sorted(cdir.glob("*.yaml")):
        data = docs.get(path)
        if not isinstance(data, dict):
            continue
        where = rel(path)
        check(data.get("status") == "candidate", f"{where}: status must be candidate (first connector is an open decision, D-011)")
        check(isinstance(data.get("auth"), dict) and data["auth"].get("method"), f"{where}: auth.method is required")
        check((data.get("auth") or {}).get("held_by") == "connector_service_only", f"{where}: credentials are held by the connector service only")
        entries = data.get("allowed_fields") or data.get("allowed_change_classes") or []
        check(bool(entries), f"{where}: allowed_fields (or allowed_change_classes) must not be empty")
        for entry in entries:
            check(entry.get("risk_tier") in {1, 2, 3}, f"{where}: {entry.get('field') or entry.get('class')} risk_tier must be 1, 2 or 3")
        publish = data.get("publish_rules") or {}
        check(publish.get("publish_is_separate_step") is True and publish.get("requires_separate_approval") is True,
              f"{where}: publish must be a separate, separately approved step")
        hook = data.get("webhook") or {}
        check(hook.get("signature_verification") == "required", f"{where}: webhook signature verification is required")
        check(is_placeholder(hook.get("secret_ref")), f"{where}: webhook.secret_ref must be a <DECIDE_AT_M0> Secret Manager placeholder")


def check_anonymous(docs) -> None:
    data = docs.get(CONFIG / "anonymous-eligibility.yaml")
    if not check(isinstance(data, dict), "config/anonymous-eligibility.yaml is missing or unreadable"):
        return
    tiers = data.get("tiers") or {}
    check(set(tiers) == {"rich", "reduced", "preview", "refused"}, "anonymous-eligibility.yaml: tiers must be rich, reduced, preview, refused")
    check(((tiers.get("rich") or {}).get("scope") or {}).get("max_representative_pages") == 20,
          "anonymous-eligibility.yaml: rich default is up to 20 representative pages (D-006)")
    for name, spec in tiers.items():
        if "retention" in (spec or {}):
            hours = duration_hours(spec.get("retention"))
            check(hours is not None and hours <= 7 * 24, f"anonymous-eligibility.yaml: {name} retention must be <= P7D")
        if "report" in (spec or {}):
            check(spec.get("report") == "in_app_web_only", f"anonymous-eligibility.yaml: {name} report must be in_app_web_only")
    prohibited = set(((data.get("signals") or {}).get("prohibited")) or [])
    check({"cross_site_fingerprinting", "ip_address_as_identity"} <= prohibited,
          "anonymous-eligibility.yaml: fingerprinting and IP-as-identity must be prohibited")


def check_freshness(docs) -> None:
    data = docs.get(CONFIG / "freshness.yaml")
    if not check(isinstance(data, dict), "config/freshness.yaml is missing or unreadable"):
        return
    for item in data.get("limits") or []:
        value = item.get("max_age")
        check(value is None or is_placeholder(value) or duration_hours(value) is not None,
              f"freshness.yaml {item.get('data_type')}: max_age must be an ISO 8601 duration, null or a placeholder")


def main() -> int:
    docs = load_config()
    check_no_model_ids_or_prices(docs)
    caps = check_scoring(docs)
    counts = check_rules(docs, caps)
    check_agents(docs)
    check_retention(docs)
    check_budgets(docs)
    check_providers(docs)
    check_crawlers(docs)
    check_policy_facts(docs)
    check_schema_requirements(docs)
    check_prompts(docs)
    check_connectors(docs)
    check_anonymous(docs)
    check_freshness(docs)

    print(f"Parsed {len(docs)} YAML files under {rel(CONFIG)}/")
    if counts:
        print("Rules per category: " + ", ".join(f"{k}={v}" for k, v in counts.items()) + f" (total {sum(counts.values())})")
    if errors:
        print(f"FAIL: {len(errors)} of {checks_run} checks failed")
        for message in errors:
            print(f"  - {message}")
        return 1
    print(f"PASS: {checks_run} checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
