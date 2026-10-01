#!/usr/bin/env python3
"""
suggest.py: collect Google Autocomplete suggestions for seed keywords.

Autocomplete shows phrasings and questions people actually type. That's evidence a
query exists, NOT a search volume. Report it that way. Arabic suggestions are partly
pan-Arab even with a country set, so the ones that name a city or country are the
strongest local evidence.

Usage:
  python suggest.py --seeds "تقويم شفاف" "invisalign kuwait" --hl ar --gl kw --out suggest.csv
  python suggest.py --seeds-file seeds.txt --hl en --gl sa --expand questions
  python suggest.py --seeds "كنافة" --hl ar --gl jo --expand letters --max-requests 120

Use short seeds of 1-3 words ("تقويم شفاف", not "تقويم شفاف في الكويت للكبار"). Long
seeds return few or no suggestions.

--expand:
  none       the seeds only
  questions  seeds combined with question and intent words in the seed's script
             (Arabic: كم, هل, ما, كيف, أفضل, سعر, الفرق بين, … English: how, what, best, price, vs, …)
  letters    seed + each letter (Arabic or Latin alphabet), for long-tail variants
  all        questions + letters

Limits of the source: this is Google's public but undocumented Autocomplete endpoint.
There is no published API, terms of use or rate limit for it, so it can change, throttle
or disappear at any time. Its robots.txt returned 404 when checked on 30 Sep 2026, so
fetching it is not disallowed, but treat it as a manual research aid:
  - run it for one piece of research at a time;
  - keep runs small (default cap 100 requests, hard ceiling 300);
  - never schedule it or run it in bulk, and never build a product feature on it.

It is polite by design: one request at a time, a delay between requests, and a hard
request cap. It stops at the first refusal (HTTP 403 or 429) or unexpected response
format, without retrying, and saves what it collected. If the endpoint is blocked,
say so in the report and use SERP observation instead. Every row is labelled with its
source so the report can cite it correctly.
"""
import argparse
import csv
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

ENDPOINT = "https://suggestqueries.google.com/complete/search"
SOURCE_LABEL = "Google Autocomplete (unofficial endpoint)"
HARD_MAX_REQUESTS = 300


class EndpointChanged(Exception):
    """The response no longer has the expected shape."""
AR_PREFIX = ["كم", "هل", "ما هو", "كيف", "أفضل", "افضل", "سعر", "اسعار", "الفرق بين", "لماذا", "متى", "وين", "شنو"]
AR_SUFFIX = ["سعر", "افضل", "عيوب", "مميزات", "قبل وبعد", "تجربتي", "قريب مني"]
EN_PREFIX = ["how", "what is", "is", "can", "best", "why", "which", "where"]
EN_SUFFIX = ["price", "cost", "vs", "near me", "reviews", "before and after", "worth it"]
AR_LETTERS = list("ابتثجحخدذرزسشصضطظعغفقكلمنهوي")
EN_LETTERS = list("abcdefghijklmnopqrstuvwxyz")


def is_arabic(s):
    return bool(re.search(r"[؀-ۿ]", s))


def expand(seed, mode):
    qs = [seed]
    ar = is_arabic(seed)
    if mode in ("questions", "all"):
        qs += [f"{p} {seed}" for p in (AR_PREFIX if ar else EN_PREFIX)]
        qs += [f"{seed} {s}" for s in (AR_SUFFIX if ar else EN_SUFFIX)]
    if mode in ("letters", "all"):
        qs += [f"{seed} {l}" for l in (AR_LETTERS if ar else EN_LETTERS)]
    return qs


def fetch(q, hl, gl, timeout=15):
    params = urllib.parse.urlencode({"client": "firefox", "q": q, "hl": hl, "gl": gl})
    req = urllib.request.Request(f"{ENDPOINT}?{params}", headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read(1_000_000).decode("utf-8", errors="replace")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise EndpointChanged(f"response is not JSON ({e})")
    if not (isinstance(data, list) and len(data) > 1 and isinstance(data[1], list)):
        raise EndpointChanged("response JSON has an unexpected shape")
    return [s for s in data[1] if isinstance(s, str)]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--seeds", nargs="*", default=[])
    ap.add_argument("--seeds-file")
    ap.add_argument("--hl", default="ar", help="interface language, e.g. ar or en")
    ap.add_argument("--gl", default="", help="country code, e.g. sa, kw, qa, jo")
    ap.add_argument("--expand", choices=["none", "questions", "letters", "all"], default="questions")
    ap.add_argument("--delay", type=float, default=1.0, help="seconds between requests (minimum 0.5)")
    ap.add_argument("--max-requests", type=int, default=100,
                    help=f"request cap (default 100, at most {HARD_MAX_REQUESTS})")
    ap.add_argument("--out", default="suggest.csv")
    a = ap.parse_args()

    seeds = list(a.seeds)
    if a.seeds_file:
        seeds += [l.strip() for l in open(a.seeds_file, encoding="utf-8") if l.strip() and not l.startswith("#")]
    if not seeds:
        ap.error("give --seeds or --seeds-file")
    if a.max_requests > HARD_MAX_REQUESTS:
        ap.error(f"--max-requests is capped at {HARD_MAX_REQUESTS}; split the research or use SERP observation")
    a.delay = max(a.delay, 0.5)
    queries = []
    for s in seeds:
        for q in expand(s, a.expand):
            if q not in queries:
                queries.append(q)
    if len(queries) > a.max_requests:
        print(f"Capping {len(queries)} queries at --max-requests {a.max_requests}", file=sys.stderr)
        queries = queries[: a.max_requests]

    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    rows, failures, stopped = [], 0, None
    for i, q in enumerate(queries, 1):
        if i > 1:
            time.sleep(a.delay)  # between every request, including after a failure
        try:
            sugg = fetch(q, a.hl, a.gl)
        except urllib.error.HTTPError as e:
            if e.code in (403, 429):
                stopped = f"HTTP {e.code} after {i - 1} successful request(s): the endpoint refused or rate-limited us"
                break
            failures += 1
            print(f"[{i}/{len(queries)}] failed: {q!r}: HTTP {e.code}", file=sys.stderr)
            if failures >= 5 and not rows:
                sys.exit("Autocomplete endpoint unreachable from this environment; use SERP observation instead.")
            continue
        except EndpointChanged as e:
            stopped = f"unexpected response format ({e}); the unofficial endpoint may have changed"
            break
        except Exception as e:  # noqa: BLE001
            failures += 1
            print(f"[{i}/{len(queries)}] failed: {q!r}: {type(e).__name__}: {e}", file=sys.stderr)
            if failures >= 5 and not rows:
                sys.exit("Autocomplete endpoint unreachable from this environment; use SERP observation instead.")
            continue
        seed = next((s for s in seeds if s in q), q)
        # The endpoint often echoes the query sent as suggestion #1; that isn't evidence anyone typed it.
        sugg = [x for x in sugg if x.strip().lower() != q.strip().lower()]
        for pos, sgt in enumerate(sugg, 1):
            rows.append({"seed": seed, "query_sent": q, "suggestion": sgt, "position": pos,
                         "hl": a.hl, "gl": a.gl, "fetched_at_utc": stamp, "source": SOURCE_LABEL})

    with open(a.out, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["seed", "query_sent", "suggestion", "position", "hl", "gl",
                                          "fetched_at_utc", "source"])
        w.writeheader()
        w.writerows(rows)
    uniq = sorted({r["suggestion"] for r in rows})
    qwords = re.compile(r"^(كم|هل|ما|ماهو|كيف|أفضل|افضل|لماذا|متى|وين|شنو|how|what|is|can|best|why|which|where)\b|\?|؟", re.I)
    questions = [u for u in uniq if qwords.search(u)]
    if stopped:
        print(f"STOPPED without retrying: {stopped}. Saved what was collected.", file=sys.stderr)
    print(f"{len(queries)} requests planned, {len(rows)} suggestions, {len(uniq)} unique "
          f"({len(questions)} question-style). Source: {SOURCE_LABEL}. Wrote {a.out}")
    for u in questions[:15]:
        print(f"  ? {u}")


if __name__ == "__main__":
    main()
