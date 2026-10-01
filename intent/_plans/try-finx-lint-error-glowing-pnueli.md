# Fix the lint error

## Context

The user asked to "fix lint error". There is no application code yet, so `pnpm lint` does not exist. The lint that runs today is the governance job in `.github/workflows/ci.yml`: hook tests, `scripts/check_schemas.py` and `scripts/check_config.py`.

What I ran (read-only), on Python 3.14.7:

| Check | Result |
|---|---|
| `python3 -m unittest discover -s .claude/hooks/tests` | OK, 72 tests |
| `python3 scripts/check_schemas.py --structural-only` | OK, 87 schema files |
| `python3 scripts/check_schemas.py` | FAIL: `jsonschema` package not installed, so examples and negative tests were not validated |
| `python3 scripts/check_config.py` | FAIL: PyYAML is missing |

Both failures come from missing dependencies, not from repo content. Also, `requirements-dev.txt` exists but is **empty**, even though CLAUDE.md and CI both depend on `pyyaml` and `jsonschema`. So nothing records the dependencies, and a fresh machine fails the same way.

Real content errors (bad examples, bad config) may still be hiding. The full checks cannot run until the dependencies are installed.

## Plan

1. **Fill in `requirements-dev.txt`** with the two checker dependencies:
   ```
   pyyaml
   jsonschema
   ```
   Pin versions only if the install in step 2 shows a need. Otherwise leave them unpinned to match CI's `pip install pyyaml jsonschema`.
2. **Install into an isolated venv** so the system Homebrew Python is left alone:
   `python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt`
   Check that `.gitignore` covers `.venv/`, and add it if it doesn't.
3. **Rerun the full governance checks** with `.venv/bin/python3`: hook tests, `check_schemas.py` without `--structural-only`, and `check_config.py`.
4. **Fix any real errors that show up** in `schemas/`, the examples, or `config/`. Fix the data, not the checker. Never edit hooks or tests to get a check to pass (CLAUDE.md "Never"). If a fix would change a rule or category weight, bump `methodology_version`. If a fix needs an open decision, stop and ask.
5. **Optional, only if the user wants it:** change the CI install step to `pip install -r requirements-dev.txt` so CI and local runs use one list.
6. Append an entry to `docs/assumptions.md` saying the dependencies are unpinned until M0A. Don't rewrite earlier entries.

## Files

- `requirements-dev.txt`: add the dependencies
- `.gitignore`: add `.venv/` if it's missing
- Whatever step 3 flags under `schemas/` or `config/` (unknown until the checks run)
- `docs/assumptions.md`: append only

## Verification

Show each command with its output:
- `.venv/bin/python3 -m unittest discover -s .claude/hooks/tests`: OK
- `.venv/bin/python3 scripts/check_schemas.py`: "OK: all schema checks passed" with example validation run, not skipped
- `.venv/bin/python3 scripts/check_config.py`: passes

No commit unless the user asks.
