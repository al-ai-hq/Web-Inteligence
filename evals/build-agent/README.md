# Build-agent evals (TS-EVAL-BUILD)

Status: draft for review. Owner: tech lead `<DECIDE_AT_M0: name>`.

These evals measure how well Claude Code works in this repository with the current `CLAUDE.md`, settings, hooks, skills and subagents. A change to any of those can make the agent better at one task and worse at another; the suite shows which.

## What a task is

A task is a real piece of work from this repository with an accepted outcome: something a human asked for, the agent (or an engineer) did, and a code owner accepted in a merged pull request. Synthetic puzzles do not count.

Collect 20-50 tasks. Start after M0A, once the first intents have merged, and grow the set as work lands.

## How to collect tasks

1. Take merged pull requests that came through `intent/<id>/` (intent, spec, plan). Prefer a spread: UI copy, rule fixtures, schema changes, config edits, bug fixes that started from a failing test, docs, and refusals (tasks where the right outcome is to stop, for example a request to add a write tool to an agent or to run `terraform apply`).
2. Record the base commit before the change and the prompt as it was given (or the intent file).
3. Record the accepted outcome:
   - checks that must pass (commands and expected exit codes);
   - the files the change is allowed to touch;
   - the reference diff from the merged pull request, as guidance for reviewers, not as an exact match;
   - for refusal tasks, the expected stop and the reason (hook name or policy skill).
4. Remove anything sensitive: no secrets, no client data, no personal data. If a task cannot be made safe, drop it.
5. Add the task to the suite through a pull request reviewed by the tech lead.

When review flags the same agent mistake twice, add a line to "Things Claude gets wrong" in `CLAUDE.md` and add a task that exercises it.

## Task format

ASSUMPTION: one folder per task. The runner is decided at M0A.

```text
evals/build-agent/tasks/<task-id>/
  task.yaml        # metadata, prompt, checks, allowed paths
  reference.diff   # accepted diff from the merged pull request (guidance only)
```

`task.yaml` fields (ASSUMPTION, draft):

| Field | Meaning |
| --- | --- |
| `id` | `BA-<nnn>` |
| `title` | Short description |
| `source` | Intent ID and pull request number |
| `base_commit` | Commit SHA the task starts from |
| `prompt` | The request as given, or `intent/<id>/intent.md` |
| `kind` | `change` or `refusal` |
| `allowed_paths` | Globs the change may touch |
| `checks` | Commands with expected exit codes (for example the hook tests, schema check, `pnpm test`) |
| `expected_stop` | For refusals: the hook or policy that should stop the agent |
| `rubric` | Short reviewer rubric for what the checks cannot see |
| `owner`, `added_on` | Who maintains the task, and when it was added |

## Grading

1. Deterministic first: every check command returns its expected exit code; no file outside `allowed_paths` changed; for refusals, the agent stopped and named the reason.
2. Rubric second: a reviewer scores what checks cannot see (plan quality, honest reporting of checks, citations of spec paths). Rubric scores are recorded but do not replace a failed check.
3. A task passes only when every deterministic check passes.

## When it runs and what it gates

- On every pull request that changes `CLAUDE.md` or `.claude/**`, and nightly.
- Merge check: pass rate at or above `<DECIDE_AT_M0: threshold>`. Any drop in pass rate, even above the threshold, is reviewed by the tech lead before merge.
- Runner: `<DECIDE_AT_M0: headless Claude Code in CI (for example claude-code-action through Vertex AI) or managed Code Review>`. The runner has no production credentials and no route to push to `main`.

## Tasks

None yet. The first tasks come from INT-00 and INT-01 once they merge.
