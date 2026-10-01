# Golden files (TS-GOLDEN)

Status: draft for review. Owner: SEO lead `<DECIDE_AT_M0: name>` (sign-off of expected outputs), with the data engineer (comparison harness).

Golden files are expected outputs produced by the vendored skill's reference scripts on saved Phase 0 fixtures. The product's own implementations (ported and tested, never imported, D-009) must reproduce them, or the difference is logged as a decision. This matches `docs/test-strategy.md` §6.4.

## Skill version pin

The generators are the scripts of `.claude/skills/marketing-seo-agent/`, the version fixed on 30 September 2026. Expected SHA-256 values:

| File | SHA-256 |
| --- | --- |
| `scripts/arabic_keywords.py` | `b13b5cd2a14f01e87456746a57ef67053e34a2782a91d73d2f03ee204898a19d` |
| `scripts/cannibalization.py` | `faf74ecd2eaf6a19517713970b6dcd05bce816cd27cb142acf267d0ebeb4ecfc` |
| `scripts/build_report.py` | `047f4f3184c4c19041e9cbaf204d726c34c33feca2dc0d0ac7520c18d689afc0` |
| `SKILL.md` | `a02923628256cea91c36e0f3a733c9f8cebcec1cc1b2ea719da77397bd5a1924` |

Check before regenerating:

```bash
cd .claude/skills/marketing-seo-agent
sha256sum scripts/arabic_keywords.py scripts/cannibalization.py scripts/build_report.py SKILL.md
```

If a hash differs, the skill changed. Stop, record the new version and its reason in `docs/decisions.md` (SEO lead approval), update this table, regenerate, and open an intent for every resulting difference.

## Layout

ASSUMPTION: one folder per script and case.

```text
evals/golden/
  arabic-keywords/<case-id>/
    case.yaml                      # source site, market, language, redaction note, reviewer, date, flags used
    input.csv                      # keyword or query export (synthetic or redacted)
    expected.csv                   # default normalization
    expected.merge-prefixes.csv    # with --merge-prefixes (candidate groups, marked prefix_merged)
  cannibalization/<case-id>/
    case.yaml                      # thresholds used: --min-impressions, --max-position, --share
    input.csv                      # Search Console page+query rows
    expected.csv
  build-report/<case-id>/
    case.yaml                      # language, date used
    report.md                      # report Markdown with tables and chart blocks, plus its CSVs
    expected/report.html
```

Fixtures come from the Phase 0 audits after the SEO lead's corrections. Keep only what the tests need; remove personal data; client exports stay out of the repository. Goldens are produced from saved files, never from live fetches.

## Regenerating

Environment: Python 3 with `pandas` and `openpyxl` (arabic_keywords.py) and `markdown-it-py` (build_report.py). `cannibalization.py` needs only the standard library. Pin the package versions at M0A and record them in each `case.yaml`.

```bash
S=.claude/skills/marketing-seo-agent/scripts
G=evals/golden

# Arabic normalization and merged metrics (CTR from totals, impression-weighted position)
python3 $S/arabic_keywords.py $G/arabic-keywords/<case>/input.csv --out $G/arabic-keywords/<case>/expected.csv
python3 $S/arabic_keywords.py $G/arabic-keywords/<case>/input.csv --merge-prefixes \
  --out $G/arabic-keywords/<case>/expected.merge-prefixes.csv

# Cannibalization from page+query rows (script defaults shown; record the values in case.yaml)
python3 $S/cannibalization.py $G/cannibalization/<case>/input.csv \
  --min-impressions 10 --max-position 20 --share 0.2 --out $G/cannibalization/<case>/expected.csv

# Report rendering: fixed date, no PDF and no PNGs so the output is reproducible
python3 $S/build_report.py $G/build-report/<case>/report.md --out-dir $G/build-report/<case>/expected \
  --date 2026-09-30 --no-pdf --no-png
```

`docs/test-strategy.md` §6.4 also lists offline extraction goldens from `page_audit.py --html-file <saved.html> --base-url <url>`. Its network fetcher is never used for goldens or by the product (D-009), and `suggest.py` never produces golden files.

Regenerating is a manual step by the SEO lead or data engineer on their own machine or a CI job, never inside `services/` or `apps/`. The `forbidden_endpoints.py` hook blocks application code that imports or runs the skill's scripts.

## How outputs are compared

| Script | Compared | Not compared |
| --- | --- | --- |
| `arabic_keywords.py` | Normalized keys, variant groups, summed clicks, impressions and volume, CTR recomputed from totals, impression-weighted position, `prefix_merged` flags | Row order, float formatting beyond an agreed tolerance (ASSUMPTION: 1e-9) |
| `cannibalization.py` | Flagged queries, competing pages, suggested owner, active flag, with the recorded thresholds | Row order |
| `build_report.py` | HTML structure: RTL detection and `dir`, table alignment, severity markers, chart data, currency decimals | Bytes, embedded fonts, dates |

## When product output differs

1. Fix the product, or
2. log the difference as a decision in `docs/decisions.md` with the SEO lead's approval and keep a note in the case's `case.yaml`.

Known expected difference: the product groups definite-article and attached-preposition variants at clustering, not at normalization (02-DETAILED-SPECIFICATION §7). So product normalization should match `expected.csv`, while `expected.merge-prefixes.csv` shows candidate groups that the product marks for review and never merges silently.

## When goldens run

- Changes to keyword, performance or report code.
- Any change to the vendored skill; each difference becomes an intent.
- Goldens are locked during fix tasks while `.claude/state/test-lock` exists.
