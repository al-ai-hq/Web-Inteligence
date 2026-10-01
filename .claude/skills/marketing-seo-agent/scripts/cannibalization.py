#!/usr/bin/env python3
"""
cannibalization.py: find queries where two or more of the site's own pages compete.

Mode 1: Search Console page+query export (the reliable method)
  A CSV with one row per (query, page), including clicks, impressions and position.
  Sources: the Search Console API, Looker Studio, BigQuery bulk export, or a Sheets add-on.
  The standard Performance export has no page+query rows, so ask for one of these.
  Arabic spelling variants are merged first (same normalization as arabic_keywords.py).

  python cannibalization.py gsc_page_query.csv --out conflicts.csv
  python cannibalization.py gsc_page_query.csv --min-impressions 20 --max-position 20

  A query is flagged when at least two pages each have >= --min-impressions and an
  average position <= --max-position. It's "active" when the second page takes at least
  --share of the query's total impressions (across all of the site's pages). The suggested owner is the page with the most
  clicks (ties broken by impressions). Thresholds are heuristics; say so in the report.

Mode 2: No Search Console data (a pre-access fallback, weaker evidence)
  Uses a page_audit.py crawl. It lists pages whose <title> or H1 contain the same target
  keyword, and pages that share an identical normalized title or H1.

  python cannibalization.py --crawl crawl.json --keywords "توصيل كنافة" "kunafa delivery"
"""
import argparse
import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from arabic_keywords import normalize  # noqa: E402

COLS = {
    "query": ["query", "queries", "top queries", "search query", "keyword"],
    "page": ["page", "pages", "top pages", "url", "landing page", "landing_page"],
    "clicks": ["clicks", "url clicks"],
    "impressions": ["impressions"],
    "position": ["position", "average position", "avg position", "avg. position"],
}


def pick(cols, key):
    low = {c.lower().strip(): c for c in cols}
    for name in COLS[key]:
        if name in low:
            return low[name]
    for c in cols:
        if any(n in c.lower() for n in COLS[key]):
            return c
    return None


def num(v):
    try:
        return float(str(v).replace(",", "").replace("%", "").strip() or 0)
    except ValueError:
        return 0.0


def from_gsc(path, min_impr, max_pos, share, merge_prefixes=False):
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(l for l in f if l.strip() and not l.lstrip().startswith("#")))
    if not rows:
        sys.exit("empty file")
    cols = list(rows[0].keys())
    c = {k: pick(cols, k) for k in COLS}
    missing = [k for k in ("query", "page", "impressions") if not c[k]]
    if missing:
        sys.exit(f"missing columns {missing}; found {cols}. A page+query export is needed.")
    agg = defaultdict(lambda: defaultdict(lambda: {"clicks": 0.0, "impr": 0.0, "posw": 0.0, "variants": set()}))
    for r in rows:
        q = normalize(r[c["query"]], merge_prefixes=merge_prefixes)
        if not q:
            continue
        d = agg[q][r[c["page"]].strip()]
        i = num(r[c["impressions"]])
        d["clicks"] += num(r[c["clicks"]]) if c["clicks"] else 0
        d["impr"] += i
        d["posw"] += (num(r[c["position"]]) if c["position"] else 0) * i
        d["variants"].add(r[c["query"]].strip())
    out = []
    for q, pages in agg.items():
        cand = []
        for page, d in pages.items():
            pos = d["posw"] / d["impr"] if d["impr"] and c["position"] else None
            if d["impr"] >= min_impr and (pos is None or pos <= max_pos):
                cand.append((page, d, pos))
        if len(cand) < 2:
            continue
        tot_i = sum(d["impr"] for d in pages.values())  # all of the query's impressions, every page
        cand.sort(key=lambda t: (-t[1]["clicks"], -t[1]["impr"]))
        second_share = sorted((d["impr"] / tot_i for _, d, _ in cand), reverse=True)[1] if tot_i else 0
        variants = sorted(set().union(*(d["variants"] for _, d, _ in cand)))
        for rank, (page, d, pos) in enumerate(cand):
            out.append({
                "query_normalized": q, "query_variants": " | ".join(variants),
                "page": page, "role": "suggested owner" if rank == 0 else "competing",
                "clicks": int(d["clicks"]), "impressions": int(d["impr"]),
                "avg_position": round(pos, 2) if pos is not None else "",
                "impression_share_pct": round(100 * d["impr"] / tot_i, 1) if tot_i else "",
                "status": "active" if second_share >= share else "minor",
            })
    return out


def from_crawl(path, keywords):
    data = json.load(open(path, encoding="utf-8"))
    pages = [(p.get("final_url") or p.get("requested_url"), p.get("data") or {}) for p in data.get("pages", [])]
    out = []
    for kw in keywords:
        k = normalize(kw)
        hits = [(u, d) for u, d in pages
                if k and (k in normalize(d.get("title") or "") or any(k in normalize(h) for h in d.get("headings", {}).get("h1", [])))]
        if len(hits) >= 2:
            for u, d in hits:
                out.append({"keyword": kw, "page": u, "title": d.get("title"),
                            "h1": " | ".join(d.get("headings", {}).get("h1", [])), "signal": "keyword in title/H1 of 2+ pages"})
    for field in ("title", "h1"):
        groups = defaultdict(list)
        for u, d in pages:
            vals = [d.get("title")] if field == "title" else d.get("headings", {}).get("h1", [])
            for v in vals:
                if v:
                    groups[normalize(v)].append(u)
        for v, us in groups.items():
            if len(set(us)) >= 2:
                for u in sorted(set(us)):
                    out.append({"keyword": "", "page": u, "title": "", "h1": "", "signal": f"identical {field}: {v[:80]}"})
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("export", nargs="?", help="Search Console page+query CSV")
    ap.add_argument("--crawl", help="page_audit.py JSON (no-GSC fallback)")
    ap.add_argument("--keywords", nargs="*", default=[], help="target keywords for --crawl mode")
    ap.add_argument("--min-impressions", type=float, default=10)
    ap.add_argument("--max-position", type=float, default=20)
    ap.add_argument("--share", type=float, default=0.2, help="second page's impression share to call it active")
    ap.add_argument("--merge-prefixes", action="store_true",
                    help="Mode 1: also merge ال / بال / لل ... query forms, as in arabic_keywords.py")
    ap.add_argument("--out", default="cannibalization.csv")
    a = ap.parse_args()
    if a.export:
        rows = from_gsc(a.export, a.min_impressions, a.max_position, a.share, a.merge_prefixes)
    elif a.crawl:
        rows = from_crawl(a.crawl, a.keywords)
    else:
        ap.error("give a page+query export or --crawl")
    if not rows:
        print("No conflicts found with these thresholds.")
        return
    with open(a.out, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    if a.export:
        qs = {r["query_normalized"] for r in rows}
        active = {r["query_normalized"] for r in rows if r["status"] == "active"}
        print(f"{len(qs)} queries with 2+ competing pages ({len(active)} active). Wrote {a.out}")
        order = sorted(active, key=lambda q: -sum(r["impressions"] for r in rows if r["query_normalized"] == q))
        for q in order[:10]:
            ps = [r for r in rows if r["query_normalized"] == q]
            print(f"  {q}: " + "; ".join(f"{r['page']} ({r['impression_share_pct']}% impr, pos {r['avg_position']})" for r in ps))
    else:
        print(f"{len(rows)} page flags. Wrote {a.out}")
        for r in rows[:10]:
            print(f"  {r['signal']}: {r['page']}")


if __name__ == "__main__":
    main()
