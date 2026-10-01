#!/usr/bin/env python3
"""protect_prod_infra: PreToolUse hook for Bash and Edit|Write.

Blocks:
- `terraform apply` and `terraform destroy` anywhere (infrastructure changes
  run through the reviewed pipeline, never from a Claude Code session);
- Bash commands that target a production project (a project ID matching
  `*-prod*` or `prod-*`, given with --project, CLOUDSDK_CORE_PROJECT or
  `gcloud config set project`) together with a mutating verb such as delete,
  deploy or apply;
- edits under infra/terraform/prod/ (Edit, Write, or Bash writes such as
  redirection, sed -i, cp, mv, rm, tee) unless the environment variable
  WPI_CHANGE_TICKET matches ^[A-Z]+-[0-9]+$.

Standard library only and self-contained, so the organization can also deploy
it as a managed hook.

Exit 0 allows. Exit 2 blocks with the reason on stderr.

Sources: 02-DETAILED-SPECIFICATION section 12 ("never by hand in production"),
04-CLAUDE-CODE-BUILD-PROMPT section 24 (deny production writes by default),
05-PROJECT-PLAN section 8 (production requires named approval).
"""
import json
import os
import re
import sys

HOOK = "protect_prod_infra"
TICKET_ENV = "WPI_CHANGE_TICKET"
TICKET_RE = re.compile(r"^[A-Z]+-[0-9]+$")
PROD_TF_PREFIX = "infra/terraform/prod/"

ROUTE_APPLY = (
    "Infrastructure changes are applied by the Cloud Build / Cloud Deploy pipeline "
    "from a merged pull request, never from a Claude Code session. Run `terraform "
    "plan` locally, attach the plan to the pull request, and let the pipeline apply "
    "it. Production needs the release manager's authorization and a change ticket."
)
ROUTE_PROD_CMD = (
    "Claude Code sessions hold no production rights. Ask the release manager to run "
    "the production change through the approved pipeline or runbook, with a change "
    "ticket, or rehearse the command against a dev or staging project."
)
ROUTE_EDIT = (
    "Edits under infra/terraform/prod/ need a change ticket. Get a ticket approved, "
    "then start the session with WPI_CHANGE_TICKET=<KEY-123> set in the environment "
    "(format ^[A-Z]+-[0-9]+$). The change still goes through a reviewed pull request "
    "and the pipeline."
)

TERRAFORM_RE = re.compile(r"\b(?:terraform|tofu)\b(?:\s+-[^\s]+)*\s+(apply|destroy)\b")
MUTATING_VERBS = re.compile(
    r"(?<![\w-])(delete|deploy|apply|create|update|patch|destroy|set-iam-policy|"
    r"add-iam-policy-binding|remove-iam-policy-binding)(?![\w-])")
PROJECT_FLAG_RE = re.compile(r"--project(?:=|\s+)[\"']?([^\s\"';|&]+)")
PROJECT_ENV_RE = re.compile(r"\bCLOUDSDK_CORE_PROJECT=[\"']?([^\s\"';|&]+)")
CONFIG_SET_RE = re.compile(r"\bgcloud\s+config\s+set\s+(?:core/)?project\s+[\"']?([^\s\"';|&]+)")
PROD_TF_BASH_WRITE = re.compile(
    r"(>{1,2}\s*\S*infra/terraform/prod/|\bsed\s+(?:-[^\s]*\s+)*-i|\bperl\s+-[^\s]*i|"
    r"\btee\b|\bcp\b|\bmv\b|\brm\b|\btruncate\b|\bdd\b|\binstall\b|\bln\b|\bgit\s+(?:checkout|restore|apply)\b)")


def block(reason, route):
    sys.stderr.write("BLOCKED by %s: %s\nApproval route: %s\n" % (HOOK, reason, route))
    sys.exit(2)


def ticket_ok():
    return bool(TICKET_RE.match(os.environ.get(TICKET_ENV, "")))


def is_prod_project(project):
    project = project.strip().lower()
    return "-prod" in project or project.startswith("prod-") or project in ("prod", "production")


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


def check_bash(command):
    m = TERRAFORM_RE.search(command)
    if m:
        block("`terraform %s` is not run from a Claude Code session" % m.group(1), ROUTE_APPLY)

    projects = PROJECT_FLAG_RE.findall(command) + PROJECT_ENV_RE.findall(command)
    prod = [p for p in projects if is_prod_project(p)]
    if prod:
        verb = MUTATING_VERBS.search(command)
        if verb:
            block("command runs `%s` against production project %s"
                  % (verb.group(1), prod[0]), ROUTE_PROD_CMD)
    for project in CONFIG_SET_RE.findall(command):
        if is_prod_project(project):
            block("command sets production project %s as the gcloud default" % project,
                  ROUTE_PROD_CMD)

    if "infra/terraform/prod" in command.replace("\\", "/") and not ticket_ok():
        if PROD_TF_BASH_WRITE.search(command):
            block("command may modify files under infra/terraform/prod/ without a valid %s"
                  % TICKET_ENV, ROUTE_EDIT)


def main():
    raw = sys.stdin.read()
    try:
        data = json.loads(raw) if raw.strip() else {}
    except ValueError:
        block("hook input is not valid JSON, so the call could not be checked", ROUTE_PROD_CMD)
    if not isinstance(data, dict):
        block("hook input is not a JSON object, so the call could not be checked", ROUTE_PROD_CMD)
    tool_name = data.get("tool_name") or ""
    tool_input = data.get("tool_input") or {}
    if not isinstance(tool_input, dict):
        sys.exit(0)

    if tool_name == "Bash":
        check_bash(str(tool_input.get("command") or ""))
        sys.exit(0)

    file_path = tool_input.get("file_path")
    if file_path:
        rels = relative_paths(file_path, project_dir(data), data.get("cwd"))
        if any(rel.startswith(PROD_TF_PREFIX) or rel == PROD_TF_PREFIX.rstrip("/") for rel in rels):
            if not ticket_ok():
                given = os.environ.get(TICKET_ENV)
                detail = "is not set" if not given else "does not match ^[A-Z]+-[0-9]+$"
                block("edit to %s: %s %s" % (rels[0], TICKET_ENV, detail), ROUTE_EDIT)
    sys.exit(0)


if __name__ == "__main__":
    main()
