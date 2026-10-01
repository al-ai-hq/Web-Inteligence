#!/usr/bin/env python3
"""
arabic_keywords.py: merge Arabic spelling variants in keyword and query exports.

Arabic queries for one topic arrive as many strings (كنافة / كنافه, أسعار / اسعار,
ى / ي). Measuring them separately understates the topic. This script normalizes
each keyword for grouping only, then aggregates metrics correctly:
  - clicks, impressions, volume: summed across variants
  - CTR: recomputed as total clicks / total impressions (never averaged)
  - position: impression-weighted mean (plain mean only if no impressions column)
  - difficulty / CPC: kept as min-max range, since summing them is meaningless

Works with Search Console, Semrush, Ahrefs and similar CSV/XLSX exports. It detects
the keyword column and metric columns by name, including comparison exports with
one column per period (e.g. "Aug 1 - Aug 31, 2026 Clicks").

What merges by default (spelling only): diacritics and tatweel removed; أ إ آ ٱ -> ا;
ى -> ي; ة -> ه; ؤ -> و; ئ -> ي; Arabic-Indic digits -> 0-9; punctuation removed.

With --merge-prefixes, it also merges definite-article and attached-preposition forms:
a leading ال, وال, بال, كال, فال or لل is removed from each Arabic word when at least 3
letters remain (repeated, so الالتزام and التزام meet), and a standalone في is dropped,
so "مطاعم بالرياض", "مطاعم في الرياض" and "المطاعم الرياض" become one group. This is light
stemming: it can occasionally merge unrelated words, so every group it creates is marked
prefix_merged=True in the output. Review those groups before you report on them.
Singular/plural and dialect synonyms are NOT merged; cluster those by SERP overlap.

Usage:
  python arabic_keywords.py Queries.csv --out merged.csv
  python arabic_keywords.py Queries.csv --merge-prefixes --out merged.csv
  python arabic_keywords.py export.xlsx --keyword-col "Keyword" --out merged.csv
  python -c "from arabic_keywords import normalize; print(normalize('كنافه نابلسيه'))"
  python -c "from arabic_keywords import normalize; print(normalize('بالرياض', merge_prefixes=True))"

Normalization is for grouping and measuring only. Published copy keeps correct
spelling.
"""
import argparse
import re
import sys

TASHKEEL = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭ]")
TATWEEL = "ـ"
PUNCT = re.compile(r"[^\w\s]|_", re.UNICODE)
EASTERN_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")
# Applied to text that is already normalized (so no hamza forms or tatweel remain).
ARTICLE_PREFIXES = ("وال", "بال", "كال", "فال", "لل", "ال")
STANDALONE_DROP = {"في"}
MIN_STEM = 3


def strip_prefixes(word: str) -> str:
    """Remove a leading article or article+preposition while at least MIN_STEM letters remain."""
    changed = True
    while changed:
        changed = False
        for pre in ARTICLE_PREFIXES:
            if word.startswith(pre) and len(word) - len(pre) >= MIN_STEM:
                word = word[len(pre):]
                changed = True
                break
    return word


def normalize(text: str, merge_prefixes: bool = False) -> str:
    """Light Arabic normalization for grouping. Latin text is lowercased.
    merge_prefixes=True also merges ال / بال / لل ... forms and drops a standalone في."""
    if text is None:
        return ""
    t = str(text).strip().lower()
    t = TASHKEEL.sub("", t).replace(TATWEEL, "")
    t = re.sub("[إأآٱ]", "ا", t)
    t = t.replace("ى", "ي").replace("ة", "ه")
    t = t.replace("ؤ", "و").replace("ئ", "ي")
    t = t.translate(EASTERN_DIGITS)
    t = PUNCT.sub(" ", t)
    t = re.sub(r"\s+", " ", t).strip()
    if merge_prefixes and t:
        words = t.split(" ")
        kept = [w for w in words if w not in STANDALONE_DROP] or words
        t = " ".join(strip_prefixes(w) for w in kept)
    return t


def script_of(text: str) -> str:
    s = str(text)
    ar = bool(re.search(r"[؀-ۿ]", s))
    la = bool(re.search(r"[A-Za-z]", s))
    return "mixed" if ar and la else "arabic" if ar else "latin" if la else "other"


KEYWORD_NAMES = ["top queries", "query", "queries", "keyword", "keywords", "search term",
                 "search query", "الاستعلامات", "طلبات البحث", "الكلمة الرئيسية"]


def detect_keyword_col(cols):
    low = {c: c.strip().lower() for c in cols}
    for name in KEYWORD_NAMES:
        for c, l in low.items():
            if l == name:
                return c
    for c, l in low.items():
        if any(n in l for n in ("query", "keyword", "search term")):
            return c
    return cols[0]


def metric_kind(col):
    l = col.lower()
    if "click" in l:
        return "clicks"
    if "impression" in l:
        return "impressions"
    if "ctr" in l:
        return "ctr"
    if "position" in l or l in ("pos", "rank", "current position"):
        return "position"
    if "volume" in l or "searches" in l:
        return "volume"
    if l.startswith("kd") or "difficulty" in l:
        return "difficulty"
    if "cpc" in l:
        return "cpc"
    return None


def period_prefix(col, kind):
    """For comparison exports, return the part of the name before the metric word."""
    m = re.search({"clicks": r"click", "impressions": r"impression", "ctr": r"ctr",
                   "position": r"position"}.get(kind, r"$^"), col, re.I)
    return col[: m.start()].strip() if m else ""


def main():
    try:
        import pandas as pd
    except ImportError:
        sys.exit("pandas required: pip install pandas openpyxl")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("path")
    ap.add_argument("--keyword-col")
    ap.add_argument("--sheet", default=0)
    ap.add_argument("--merge-prefixes", action="store_true",
                    help="also merge ال / بال / لل ... forms and a standalone في (review prefix_merged groups)")
    ap.add_argument("--out", default="keywords_merged.csv")
    a = ap.parse_args()

    if a.path.lower().endswith((".xlsx", ".xls")):
        df = pd.read_excel(a.path, sheet_name=a.sheet)
    else:
        df = pd.read_csv(a.path, comment="#", encoding="utf-8-sig")
    kw = a.keyword_col or detect_keyword_col(list(df.columns))

    def to_num(s):
        return pd.to_numeric(s.astype(str).str.replace("%", "").str.replace(",", "").str.strip(),
                             errors="coerce")

    kinds = {c: metric_kind(c) for c in df.columns if c != kw}
    for c, k in kinds.items():
        if k:
            df[c] = to_num(df[c])

    df["_light"] = df[kw].map(normalize)
    df["_norm"] = df[kw].map(lambda x: normalize(x, merge_prefixes=a.merge_prefixes))
    df = df[df["_norm"] != ""]

    groups = []
    for norm, g in df.groupby("_norm", sort=False):
        row = {"normalized": norm,
               "variants": " | ".join(dict.fromkeys(g[kw].astype(str))),
               "variant_count": g[kw].nunique(),
               "script": script_of(g[kw].iloc[0])}
        if a.merge_prefixes:
            row["prefix_merged"] = bool(g["_light"].nunique() > 1)
        # Pair each click/position/ctr column with an impressions column of the same period
        imp_cols = {period_prefix(c, "impressions"): c for c, k in kinds.items() if k == "impressions"}
        clk_cols = {period_prefix(c, "clicks"): c for c, k in kinds.items() if k == "clicks"}
        for c, k in kinds.items():
            if k in ("clicks", "impressions", "volume"):
                row[c] = g[c].sum(min_count=1)
            elif k == "position":
                imp = imp_cols.get(period_prefix(c, "position"))
                if imp is not None and g[imp].fillna(0).sum() > 0:
                    w = g[imp].fillna(0)
                    row[c] = round(float((g[c] * w).sum() / w.sum()), 2)
                else:
                    row[c] = round(float(g[c].mean()), 2) if g[c].notna().any() else None
            elif k == "ctr":
                p = period_prefix(c, "ctr")
                ci, ii = clk_cols.get(p), imp_cols.get(p)
                if ci is not None and ii is not None:
                    tot_i = g[ii].sum()
                    row[c + " (recomputed, %)"] = round(100 * g[ci].sum() / tot_i, 2) if tot_i else None
            elif k in ("difficulty", "cpc"):
                lo, hi = g[c].min(), g[c].max()
                row[c] = lo if lo == hi else f"{lo}–{hi}"
        groups.append(row)

    out = pd.DataFrame(groups)
    sort_col = next((c for c, k in kinds.items() if k in ("impressions", "volume", "clicks")), None)
    if sort_col is not None and sort_col in out:
        out = out.sort_values(sort_col, ascending=False)
    out.to_csv(a.out, index=False, encoding="utf-8-sig")
    merged = int((out["variant_count"] > 1).sum())
    print(f"Keyword column: {kw!r}. {len(df)} rows -> {len(out)} groups; {merged} groups merged variants. Wrote {a.out}")
    if merged:
        print(out[out["variant_count"] > 1].head(10)[["variants"] + ([sort_col] if sort_col else [])].to_string(index=False))
    if a.merge_prefixes and "prefix_merged" in out:
        pm = out[out["prefix_merged"]]
        print(f"{len(pm)} group(s) merged by the article/preposition rule (prefix_merged=True). Review them:")
        if len(pm):
            print(pm.head(10)[["variants"]].to_string(index=False))


if __name__ == "__main__":
    main()
