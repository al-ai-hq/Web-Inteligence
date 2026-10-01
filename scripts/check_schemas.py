#!/usr/bin/env python3
"""Lint the WPI JSON Schemas and validate the examples.

Usage:
    python3 scripts/check_schemas.py [--root PATH]

Structural lint (standard library only), for every schemas/*.schema.json:
  - the file is valid JSON;
  - $schema is JSON Schema draft 2020-12;
  - $id is urn:wpi:schema:<kebab-name>:<version>, <kebab-name> equals the file name
    and <version> equals x-version;
  - title (PascalCase), description, type "object", x-version and x-migration are present;
  - the top level sets required, properties and additionalProperties;
  - every object definition ("type": "object" with "properties") sets
    additionalProperties, and its required list is a subset of its properties;
  - every $ref resolves: "#/..." inside the same file, "<file>.schema.json#/..." to
    another file in schemas/;
  - no schema repeats an enum that common.schema.json already defines (use $ref);
  - every name in the V4 minimum schema set (03-PRODUCTION-CONTRACTS) has a file,
    and every other file is either a required configuration schema or is marked
    "x-not-in-v4-minimum-set": true.

Example validation (only when the jsonschema package is importable):
  - every schemas/examples/<kebab-name>.example.json must validate against
    schemas/<kebab-name>.schema.json;
  - every schemas/examples/invalid/<kebab-name>.<case>.invalid.json is a negative
    test written as {"description", "base_example", "patch"}: "base_example" names a
    valid example of the same schema, "patch" is a list of JSON Patch operations
    (add, replace, remove). The base must validate and the patched copy must FAIL,
    so each negative test fails only because of its patch;
  - schemas are loaded into a referencing Registry under both their urn $id and
    their file name, so "common.schema.json#/$defs/..." references resolve.
If jsonschema is not importable, the script fails (so a missing validator never looks like a pass), unless it is run with --structural-only.

Exit status: 0 when every check passes, 1 otherwise.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

DIALECT = "https://json-schema.org/draft/2020-12/schema"
ID_RE = re.compile(r"^urn:wpi:schema:([a-z0-9]+(?:-[a-z0-9]+)*):((?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*))$")
KEBAB_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
TITLE_RE = re.compile(r"^[A-Z][A-Za-z0-9]*$")
SEMVER_RE = re.compile(r"^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$")
ALLOWED_STATUS = {"draft", "proposed", "accepted"}

# 03-PRODUCTION-CONTRACTS, "Minimum schema set" (PascalCase name -> file stem).
V4_MINIMUM_SET = {
    "CapabilityManifest": "capability-manifest",
    "Audit": "audit", "AuditScope": "audit-scope", "JobStage": "job-stage", "Attempt": "attempt",
    "EvidenceObject": "evidence-object", "LineageRecord": "lineage-record", "PolicyFact": "policy-fact",
    "RuleDefinition": "rule-definition", "RuleResult": "rule-result", "ScoreResult": "score-result", "Finding": "finding",
    "KeywordRow": "keyword-row", "KeywordCluster": "keyword-cluster", "PageOwnership": "page-ownership",
    "RankSnapshot": "rank-snapshot",
    "PromptSet": "prompt-set", "PromptRun": "prompt-run", "Citation": "citation", "AccuracyIssue": "accuracy-issue",
    "PerformanceObservation": "performance-observation", "PerformanceDiagnosis": "performance-diagnosis",
    "FactRegister": "fact-register", "EntityConflict": "entity-conflict",
    "PublicSourceObservation": "public-source-observation",
    "CommerceItem": "commerce-item", "FeedObservation": "feed-observation", "MerchantIssue": "merchant-issue",
    "PolicyConsistencyResult": "policy-consistency-result",
    "Location": "location", "ProfileObservation": "profile-observation", "NAPObservation": "nap-observation",
    "ReviewCase": "review-case",
    "PlatformCapability": "platform-capability", "ImplementationPath": "implementation-path",
    "MigrationBaseline": "migration-baseline", "URLInventoryRow": "url-inventory-row", "RedirectRule": "redirect-rule",
    "ParityResult": "parity-result", "GoNoGoItem": "go-no-go-item", "RollbackTrigger": "rollback-trigger",
    "ContentOpportunity": "content-opportunity", "ContentBrief": "content-brief", "ContentDraft": "content-draft",
    "Recommendation": "recommendation", "PlanItem": "plan-item", "Roadmap": "roadmap",
    "ChangeSet": "change-set", "ChangeOperation": "change-operation", "Approval": "approval", "Snapshot": "snapshot",
    "Verification": "verification", "Rollback": "rollback",
    "WebhookEvent": "webhook-event", "ConnectorCapability": "connector-capability",
    "ProviderBreaker": "provider-breaker", "CostLedgerEntry": "cost-ledger-entry",
    "ReportModel": "report-model", "ExportAuthorization": "export-authorization",
    "RetentionRecord": "retention-record", "DeletionReceipt": "deletion-receipt",
    "ArchitecturePlan": "architecture-plan", "PageMapRow": "page-map-row",
    "InternalLinkPlanRow": "internal-link-plan-row", "SERPOverlapObservation": "serp-overlap-observation",
    "BacklinkObservation": "backlink-observation", "ReferringDomainObservation": "referring-domain-observation",
    "LinkTargetStatus": "link-target-status", "DisavowCandidate": "disavow-candidate",
    "ComparisonClaim": "comparison-claim", "ComparisonSource": "comparison-source",
    "ComparisonReview": "comparison-review",
    "ProgrammaticTemplate": "programmatic-template", "ProgrammaticRecord": "programmatic-record",
    "GenerationBatch": "generation-batch", "SimilarityObservation": "similarity-observation",
    "BatchDecision": "batch-decision",
    "CrawlSnapshot": "crawl-snapshot", "CrawlDiff": "crawl-diff", "DiffReview": "diff-review",
    "RegressionDecision": "regression-decision",
}
# 03-PRODUCTION-CONTRACTS, "Required configuration", plus the shared library.
REQUIRED_CONFIG_SCHEMAS = {"fact-sheet", "keyword-upload", "brand-terms"}
LIBRARY = "common"
REQUIRED_EXAMPLES = ["evidence-object", "finding", "keyword-row", "keyword-upload", "plan-item", "change-set",
                     "prompt-run", "export-authorization"]


class Report:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.notes: list[str] = []

    def error(self, where: str, message: str) -> None:
        self.errors.append(f"{where}: {message}")

    def note(self, message: str) -> None:
        self.notes.append(message)


def load_json(path: Path, report: Report, label: str | None = None):
    where = label or str(path)
    try:
        with path.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    except json.JSONDecodeError as exc:
        report.error(where, f"invalid JSON: {exc}")
    except OSError as exc:
        report.error(where, f"cannot read: {exc}")
    return None


def walk(node, pointer: str = ""):
    """Yield (json_pointer, dict) for every dict inside a schema document."""
    if isinstance(node, dict):
        yield pointer, node
        for key, value in node.items():
            yield from walk(value, f"{pointer}/{escape(key)}")
    elif isinstance(node, list):
        for index, value in enumerate(node):
            yield from walk(value, f"{pointer}/{index}")


def escape(token: str) -> str:
    return token.replace("~", "~0").replace("/", "~1")


def resolve_pointer(doc, pointer: str) -> bool:
    if pointer in ("", "#"):
        return True
    if not pointer.startswith("/"):
        return False
    node = doc
    for raw in pointer[1:].split("/"):
        token = raw.replace("~1", "/").replace("~0", "~")
        if isinstance(node, dict) and token in node:
            node = node[token]
        elif isinstance(node, list) and token.isdigit() and int(token) < len(node):
            node = node[int(token)]
        else:
            return False
    return True


def collect_common_enums(common_doc) -> dict[frozenset, str]:
    enums: dict[frozenset, str] = {}
    for name, definition in (common_doc or {}).get("$defs", {}).items():
        values = definition.get("enum") if isinstance(definition, dict) else None
        if isinstance(values, list) and len(values) > 1:
            enums[frozenset(json.dumps(v, sort_keys=True) for v in values)] = name
    return enums


def lint_schema(path: Path, doc, docs_by_file: dict, common_enums: dict, report: Report) -> None:
    where = f"schemas/{path.name}"
    stem = path.name[: -len(".schema.json")]
    if not isinstance(doc, dict):
        report.error(where, "top level is not a JSON object")
        return
    if not KEBAB_RE.match(stem):
        report.error(where, "file name is not kebab-case")
    if doc.get("$schema") != DIALECT:
        report.error(where, f"$schema must be {DIALECT}")
    match = ID_RE.match(str(doc.get("$id", "")))
    if not match:
        report.error(where, "$id must match urn:wpi:schema:<kebab-name>:<MAJOR.MINOR.PATCH>")
    else:
        if match.group(1) != stem:
            report.error(where, f"$id name '{match.group(1)}' does not match file name '{stem}'")
        if match.group(2) != doc.get("x-version"):
            report.error(where, "$id version does not equal x-version")
    title = doc.get("title")
    if not isinstance(title, str) or not TITLE_RE.match(title):
        report.error(where, "title missing or not PascalCase")
    if not isinstance(doc.get("description"), str) or not doc["description"].strip():
        report.error(where, "description missing")
    if doc.get("type") != "object":
        report.error(where, 'type must be "object"')
    if not isinstance(doc.get("x-version"), str) or not SEMVER_RE.match(doc["x-version"]):
        report.error(where, "x-version missing or not MAJOR.MINOR.PATCH")
    if not isinstance(doc.get("x-migration"), str) or not doc["x-migration"].strip():
        report.error(where, "x-migration missing")
    if doc.get("x-status") not in ALLOWED_STATUS:
        report.error(where, f"x-status must be one of {sorted(ALLOWED_STATUS)}")
    for key in ("required", "properties", "additionalProperties"):
        if key not in doc:
            report.error(where, f"top level must set '{key}'")

    for pointer, node in walk(doc):
        at = f"{where}#{pointer or '/'}"
        props = node.get("properties")
        if isinstance(node.get("required"), list) and isinstance(props, dict):
            missing = [name for name in node["required"] if name not in props]
            # Partial overlays inside if/then may require properties defined at the parent level.
            if missing and node.get("type") == "object":
                report.error(at, f"required names not in properties: {missing}")
        if (pointer and node.get("type") == "object" and isinstance(props, dict)
                and "additionalProperties" not in node):
            report.error(at, "object definition does not set additionalProperties")
        ref = node.get("$ref")
        if isinstance(ref, str):
            check_ref(ref, doc, docs_by_file, at, report)
        values = node.get("enum")
        if stem != LIBRARY and isinstance(values, list) and len(values) > 1:
            key = frozenset(json.dumps(v, sort_keys=True) for v in values)
            if key in common_enums:
                report.error(at, f"repeats common enum '{common_enums[key]}'; use $ref to common.schema.json")


def check_ref(ref: str, doc, docs_by_file: dict, at: str, report: Report) -> None:
    if ref.startswith("#"):
        if not resolve_pointer(doc, ref[1:]):
            report.error(at, f"$ref '{ref}' does not resolve in this file")
        return
    target, _, fragment = ref.partition("#")
    if "/" in target or not target.endswith(".schema.json"):
        report.error(at, f"$ref '{ref}' must point to a sibling <name>.schema.json or a local '#/...'")
        return
    other = docs_by_file.get(target)
    if other is None:
        report.error(at, f"$ref '{ref}': schemas/{target} not found or not valid JSON")
        return
    if fragment and not resolve_pointer(other, fragment):
        report.error(at, f"$ref '{ref}': pointer '{fragment}' not found in schemas/{target}")


def check_coverage(docs_by_file: dict, report: Report) -> None:
    stems = {name[: -len(".schema.json")] for name in docs_by_file}
    for title, stem in V4_MINIMUM_SET.items():
        if stem not in stems:
            report.error("schemas/", f"missing schema for V4 minimum-set name {title} ({stem}.schema.json)")
        else:
            doc = docs_by_file[f"{stem}.schema.json"]
            if isinstance(doc, dict) and doc.get("title") != title:
                report.error(f"schemas/{stem}.schema.json", f"title should be '{title}'")
    for stem in sorted(REQUIRED_CONFIG_SCHEMAS | {LIBRARY}):
        if stem not in stems:
            report.error("schemas/", f"missing required schema {stem}.schema.json")
    known = set(V4_MINIMUM_SET.values()) | REQUIRED_CONFIG_SCHEMAS | {LIBRARY}
    for stem in sorted(stems - known):
        doc = docs_by_file[f"{stem}.schema.json"]
        if not (isinstance(doc, dict) and doc.get("x-not-in-v4-minimum-set") is True):
            report.error(f"schemas/{stem}.schema.json",
                         'not in the V4 minimum set; mark it "x-not-in-v4-minimum-set": true or remove it')


def meta_validate(docs_by_file: dict, report: Report) -> None:
    from jsonschema import Draft202012Validator
    from jsonschema.exceptions import SchemaError

    for name, doc in sorted(docs_by_file.items()):
        try:
            Draft202012Validator.check_schema(doc)
        except SchemaError as exc:
            report.error(f"schemas/{name}", f"not a valid draft 2020-12 schema: {exc.message}")


def validate_examples(schema_dir: Path, docs_by_file: dict, report: Report) -> tuple[int, int]:
    from jsonschema import Draft202012Validator
    from referencing import Registry, Resource
    from referencing.jsonschema import DRAFT202012

    registry = Registry()
    for name, doc in docs_by_file.items():
        resource = Resource.from_contents(doc, default_specification=DRAFT202012)
        registry = registry.with_resources([(doc["$id"], resource), (name, resource)])

    def validator_for(stem: str):
        doc = docs_by_file.get(f"{stem}.schema.json")
        if doc is None:
            return None
        return Draft202012Validator(doc, registry=registry, format_checker=Draft202012Validator.FORMAT_CHECKER)

    example_dir = schema_dir / "examples"
    valid_count = 0
    invalid_count = 0
    for stem in REQUIRED_EXAMPLES:
        if not (example_dir / f"{stem}.example.json").is_file():
            report.error("schemas/examples/", f"required example {stem}.example.json is missing")

    for path in sorted(example_dir.glob("*.example.json")):
        stem = path.name[: -len(".example.json")]
        where = f"schemas/examples/{path.name}"
        validator = validator_for(stem)
        if validator is None:
            report.error(where, f"no schema schemas/{stem}.schema.json for this example")
            continue
        instance = load_json(path, report, where)
        if instance is None:
            continue
        problems = sorted(validator.iter_errors(instance), key=lambda e: list(e.absolute_path))
        for problem in problems:
            location = "/".join(str(p) for p in problem.absolute_path) or "(root)"
            report.error(where, f"at {location}: {problem.message}")
        valid_count += 1

    for path in sorted((example_dir / "invalid").glob("*.invalid.json")):
        where = f"schemas/examples/invalid/{path.name}"
        stem = path.name.split(".", 1)[0]
        validator = validator_for(stem)
        if validator is None:
            report.error(where, f"no schema schemas/{stem}.schema.json for this negative example")
            continue
        spec = load_json(path, report, where)
        if spec is None:
            continue
        if not (isinstance(spec, dict) and isinstance(spec.get("base_example"), str)
                and isinstance(spec.get("patch"), list) and isinstance(spec.get("description"), str)):
            report.error(where, 'must be {"description": str, "base_example": str, "patch": [ops]}')
            continue
        base_name = spec["base_example"]
        if base_name != f"{stem}.example.json":
            report.error(where, f"base_example must be {stem}.example.json")
            continue
        base = load_json(example_dir / base_name, report, f"schemas/examples/{base_name}")
        if base is None:
            continue
        if not validator.is_valid(base):
            report.error(where, f"base example {base_name} is itself invalid")
            continue
        try:
            patched = apply_patch(base, spec["patch"])
        except (KeyError, IndexError, ValueError, TypeError) as exc:
            report.error(where, f"patch cannot be applied: {exc}")
            continue
        if validator.is_valid(patched):
            report.error(where, "patched example validated but must be rejected")
        invalid_count += 1
    return valid_count, invalid_count


def apply_patch(document, operations):
    """Apply a small JSON Patch subset (add, replace, remove) to a deep copy."""
    result = json.loads(json.dumps(document))
    for operation in operations:
        op = operation["op"]
        tokens = [t.replace("~1", "/").replace("~0", "~") for t in operation["path"].split("/")[1:]]
        if not tokens:
            raise ValueError("patching the document root is not supported")
        parent = result
        for token in tokens[:-1]:
            parent = parent[int(token)] if isinstance(parent, list) else parent[token]
        last = tokens[-1]
        if isinstance(parent, list):
            index = len(parent) if last == "-" else int(last)
            if op == "add":
                parent.insert(index, operation["value"])
            elif op == "replace":
                parent[index] = operation["value"]
            elif op == "remove":
                del parent[index]
            else:
                raise ValueError(f"unsupported op {op}")
        else:
            if op in ("add", "replace"):
                if op == "replace" and last not in parent:
                    raise KeyError(last)
                parent[last] = operation["value"]
            elif op == "remove":
                del parent[last]
            else:
                raise ValueError(f"unsupported op {op}")
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent,
                        help="repository root (default: parent of scripts/)")
    parser.add_argument("--structural-only", action="store_true",
                        help="run the structural lint only; skip example validation (never use this in CI)")
    args = parser.parse_args()
    schema_dir = args.root / "schemas"
    report = Report()

    if not schema_dir.is_dir():
        print(f"FAIL: {schema_dir} not found")
        return 1

    paths = sorted(schema_dir.glob("*.schema.json"))
    docs_by_file: dict = {}
    for path in paths:
        doc = load_json(path, report, f"schemas/{path.name}")
        if doc is not None:
            docs_by_file[path.name] = doc

    common_enums = collect_common_enums(docs_by_file.get(f"{LIBRARY}.schema.json"))
    for path in paths:
        if path.name in docs_by_file:
            lint_schema(path, docs_by_file[path.name], docs_by_file, common_enums, report)
    check_coverage(docs_by_file, report)
    print(f"Structural lint: {len(paths)} schema files checked.")

    try:
        import jsonschema  # noqa: F401
        import referencing  # noqa: F401
        have_jsonschema = True
    except ImportError:
        have_jsonschema = False

    if have_jsonschema:
        meta_validate(docs_by_file, report)
        if not report.errors:
            valid_count, invalid_count = validate_examples(schema_dir, docs_by_file, report)
            print(f"Example validation: {valid_count} examples validated, "
                  f"{invalid_count} negative examples checked for rejection.")
            from jsonschema import Draft202012Validator
            unchecked = [f for f in ("date-time", "date", "uuid", "uri")
                         if f not in Draft202012Validator.FORMAT_CHECKER.checkers]
            if unchecked:
                print(f"Note: format assertions not active for {', '.join(unchecked)} (optional libraries missing; "
                      "install 'jsonschema[format-nongpl]' to enable them). Schema patterns still apply.")
        else:
            print("Example validation: not run because structural lint failed.")
    elif args.structural_only:
        print("Example validation: SKIPPED on request (--structural-only). Examples and negative tests were not checked.")
    else:
        report.errors.append("the jsonschema package is not installed, so examples and negative tests were not "
                             "validated. Install it (pip install jsonschema) or pass --structural-only to run the "
                             "structural lint alone.")

    if report.errors:
        print(f"\nFAIL: {len(report.errors)} problem(s):")
        for line in report.errors:
            print(f"  - {line}")
        return 1
    print("\nOK: all schema checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
