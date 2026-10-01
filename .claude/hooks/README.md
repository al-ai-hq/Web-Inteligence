# Claude Code hooks

Status: draft for review. Owner: security engineer (hook code) with the tech lead. Changes to any hook go through a reviewed pull request that also updates `tests/test_hooks.py`.

Hooks are deterministic local checks. They run before (PreToolUse) or after (PostToolUse) a Claude Code tool call and block with exit code 2 and a message on stderr that states the reason and the approval route. They are a backstop. They never replace authorization in the application (07-SKILLS-AND-AGENTS §9; 04-CLAUDE-CODE-BUILD-PROMPT §24).

All scripts are Python 3, standard library only, with no `jq` dependency. Each script is self-contained so it can be copied into managed settings on its own.

## Hooks

| Hook | Event | Matcher | Blocks | Why | Approval route |
| --- | --- | --- | --- | --- | --- |
| `secret_scan.py` | PreToolUse | `Edit\|Write` | New content with a private key block; Google service-account JSON (`"private_key"` with `"client_email"`); Anthropic, OpenAI, GitHub, Slack, Google API (`AIza...`), Google OAuth client-secret and AWS access-key patterns; `.env`-style `*_SECRET`, `*_TOKEN`, `*_PASSWORD`, `*_API_KEY` assignments with real values. Placeholders pass (`<...>`, `changeme`, `example`, `your-...`, empty values, `$VAR` and `projects/.../secrets/...` references) | Secrets never enter source control, prompts, logs or fixtures (04 §19, 02-DETAILED-SPECIFICATION §17) | Move the value to Secret Manager and reference it, or use a placeholder. False positives: security engineer reviews a hook change |
| `forbidden_endpoints.py` | PreToolUse | `Edit\|Write` | Code or config that calls Google Autocomplete (`suggestqueries`, `/complete/search`) or Google result pages (`google.<tld>/search`); in `apps/`, `services/`, `packages/`, any non-comment line that imports, runs or points at `.claude/skills/` or the skill's `scripts` folder. Not scanned: `docs/`, `.claude/skills/`, fixtures (`fixtures/`, `__fixtures__/`, `testdata/`, `evals/golden/`) and documentation files (`.md`, `.txt`, `.rst`) | D-009; 02 §7 (no Autocomplete, no result-page scraping); 04 §25 (skill scripts are reference implementations) | Port the logic and test it against `evals/golden/`. A policy change needs a decision in `docs/decisions.md` approved by the product owner and SEO lead |
| `agent_allowlist_guard.py` | PreToolUse | `Edit\|Write` (acts only on `config/agents/*.yaml`) | A proposed agent file (Write content, or the file on disk with the Edit applied) whose `tools:` list contains a write-class tool: `apply_change`, `publish`, `write_cms`, `delete_content`, `upload_disavow`, `send_email`, `submit_form` (also as `x.publish`, `x__publish`). Aliases in `tools:` are blocked because they cannot be verified | Split trust: only the deterministic connector service holds write credentials (02 §13, §19; 03-PRODUCTION-CONTRACTS "Agent tool boundaries") | None for agents. Tech lead and security engineer review any change to the write-class list |
| `methodology_bump.py` | PreToolUse | `Edit\|Write` (acts only on `config/rules/*.yaml` and `config/scoring.yaml`) | A change to any weight (`importance_weight:`, category weights, any value under a key containing `weight`) when `methodology_version:` does not change. Baseline is git `HEAD` when available, otherwise the file on disk. A rules file without its own version passes only if `config/scoring.yaml` already carries a bumped version | Scores must be recomputable per methodology version (02 §6); weights need approval (01-PRODUCT-REQUIREMENTS §14) | Bump `methodology_version`, record the reason in `docs/decisions.md`, SEO lead approves the pull request |
| `protect_prod_infra.py` | PreToolUse | `Bash` and `Edit\|Write` | `terraform apply` / `terraform destroy` anywhere; Bash commands on a `*-prod*` project (`--project`, `CLOUDSDK_CORE_PROJECT`) with a mutating verb (`delete`, `deploy`, `apply`, `create`, `update`, `patch`, `destroy`, IAM policy changes); `gcloud config set project *-prod*`; edits under `infra/terraform/prod/` (Edit, Write, or Bash writes) unless `WPI_CHANGE_TICKET` matches `^[A-Z]+-[0-9]+$` | Infrastructure is applied only by the pipeline, never by hand in production (02 §12); deny production writes by default (04 §24) | Plan locally, apply through Cloud Build / Cloud Deploy from a merged pull request; production needs the release manager and a change ticket |
| `test_lock.py` | PreToolUse | `Edit\|Write` and `Bash` | While `.claude/state/test-lock` exists: edits to any `tests/` or `__tests__/` folder, `*.test.*`, `*.spec.*`, and `evals/`; Bash commands that remove or change the lock, or write to those paths | A fix task must not weaken the failing test that defines it | The engineer who set the lock removes it in their own terminal or approves the test change in the pull request |
| `dangerous_bash.py` | PreToolUse | `Bash` | Recursive deletes outside the repository (or of the repository root, or with unresolvable targets such as `$UNSET/`; the system temp directory is allowed); force pushes or deletes aimed at `main`/`master`; `curl`/`wget` piped into a shell; reading credential locations (`~/.config/gcloud`, `application_default_credentials.json`, `.env` files except `.env.example`/`.sample`/`.template`/`.dist`, `~/.aws/credentials`, `~/.ssh/id_*`, `.netrc`, `.git-credentials`) or printing tokens/secrets (`gcloud auth print-access-token`, `gcloud secrets versions access`); `--dangerously-skip-permissions`. Also checks inside `sh -c`, `bash -c` and `eval` | Deny destructive, secret-reading and bypass operations by default (04 §24; 05-PROJECT-PLAN §11) | A human runs the command in their own terminal, or the step moves into a reviewed script |
| `format_changed.py` | PostToolUse | `Edit\|Write` | Nothing. Runs `node_modules/.bin/prettier --write --ignore-unknown` on the changed file only, when that binary exists (after M0A). Otherwise exits 0 silently. A formatter failure exits 1 (non-blocking, shown to the user) | No formatting drift; hooks stay fast and check only the changed file | Not applicable |

Known limits (by design, kept simple and fast):

- Pattern checks can be evaded by building strings at run time. Reviews, CI (`gitleaks`), the SSRF suite and tool-allowlist tests remain the real controls.
- `dangerous_bash.py` does not resolve targets passed through `xargs` or `find -delete`.
- `protect_prod_infra.py` blocks any command text containing `terraform apply` or `terraform destroy`, including a commit message that mentions them.
- `dangerous_bash.py` blocks any command text that names a `.env` file, including `echo ".env" >> .gitignore`. Edit `.gitignore` with the Edit tool instead.
- Invalid hook input (not JSON) fails closed with exit 2, except `format_changed.py`, which exits 0.

## Settings to merge into `.claude/settings.json`

The main author merges this block. `agent_allowlist_guard.py` and `methodology_bump.py` filter by path themselves, because matchers match tool names.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "python3",
            "args": [
              "${CLAUDE_PROJECT_DIR}/.claude/hooks/secret_scan.py"
            ]
          },
          {
            "type": "command",
            "command": "python3",
            "args": [
              "${CLAUDE_PROJECT_DIR}/.claude/hooks/forbidden_endpoints.py"
            ]
          },
          {
            "type": "command",
            "command": "python3",
            "args": [
              "${CLAUDE_PROJECT_DIR}/.claude/hooks/agent_allowlist_guard.py"
            ]
          },
          {
            "type": "command",
            "command": "python3",
            "args": [
              "${CLAUDE_PROJECT_DIR}/.claude/hooks/methodology_bump.py"
            ]
          },
          {
            "type": "command",
            "command": "python3",
            "args": [
              "${CLAUDE_PROJECT_DIR}/.claude/hooks/protect_prod_infra.py"
            ]
          },
          {
            "type": "command",
            "command": "python3",
            "args": [
              "${CLAUDE_PROJECT_DIR}/.claude/hooks/test_lock.py"
            ]
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "python3",
            "args": [
              "${CLAUDE_PROJECT_DIR}/.claude/hooks/dangerous_bash.py"
            ]
          },
          {
            "type": "command",
            "command": "python3",
            "args": [
              "${CLAUDE_PROJECT_DIR}/.claude/hooks/protect_prod_infra.py"
            ]
          },
          {
            "type": "command",
            "command": "python3",
            "args": [
              "${CLAUDE_PROJECT_DIR}/.claude/hooks/test_lock.py"
            ]
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "python3",
            "args": [
              "${CLAUDE_PROJECT_DIR}/.claude/hooks/format_changed.py"
            ]
          }
        ]
      }
    ]
  }
}
```

The hooks use exec form (`command` plus `args`): Claude Code starts `python3` directly with the script path as one argument, so a project path with spaces still works. Only exit code 2 blocks a call; if `python3` is missing or a script cannot start, the hook fails open with a non-blocking error, so check `/hooks` and the governance checks when setting up a machine.

The scripts also read a `tool_input.edits` list when present, as a defensive measure. If the Claude Code version in use exposes another file-editing tool, add its name to the `Edit|Write` matchers after checking the hook input it sends.

## Managed hooks (organization)

`secret_scan.py` and `protect_prod_infra.py` are non-negotiable. The organization should also deploy them as managed hooks, so a local settings change cannot remove them. Keep the project copies registered as well; running a check twice is harmless.

Do not turn on "managed hooks only" unless every hook above moves to managed settings. With that setting on, the project hooks in `.claude/settings.json` would not run.

A release-authorization hook for production deploys is also meant to be managed. It is not in this folder yet: it depends on the deploy pipeline chosen at M0A (see `intent/INT-00-m0a-repository-bootstrap/intent.md`).

## Test lock

Set the lock when a fix task starts from a failing test:

```bash
mkdir -p .claude/state
echo "INT-xx fix; set by <name> on <date>" > .claude/state/test-lock
```

Remove it in your own terminal after review. `.claude/state/` is local session state and should be listed in `.gitignore`.

## Running the tests

```bash
python3 -m unittest discover -s .claude/hooks/tests -v
```

The suite runs each hook as a subprocess with crafted hook JSON, with at least three blocking and three allowed cases per hook. Fake secrets and forbidden URLs in the tests are assembled from fragments, so the test file passes `secret_scan.py` and `forbidden_endpoints.py`. CI runs the suite in the `governance` job (`.github/workflows/ci.yml`).
