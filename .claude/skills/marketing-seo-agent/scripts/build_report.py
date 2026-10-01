#!/usr/bin/env python3
"""
build_report.py: export a Markdown SEO report as a self-contained HTML page and a PDF.

What it does
  - Markdown tables become styled tables. Numeric cells are aligned, the header row
    repeats across PDF pages, and cells reading Critical/High/Medium/Low get a severity marker.
  - Fenced ```chart blocks (a JSON spec) become SVG charts, drawn from inline data or
    from a CSV file next to the report. Chart types: line, bar, hbar, kpi.
  - Local images referenced in the Markdown (for example charts made with matplotlib)
    are embedded, so the HTML page is a single file.
  - Arabic reports are detected automatically and laid out right-to-left.
  - IBM Plex Sans Arabic (SIL OFL) is embedded from ../assets/fonts, so the page renders
    the same offline, in email attachments and in the PDF.
  - Each chart is also saved as a PNG (charts/…png) for pasting into Docs or Word.

Usage
  python build_report.py report.md --out-dir outputs/
  python build_report.py report.md --out-dir outputs/ --no-pdf
  python build_report.py report.md --lang ar --subtitle "Prepared for …" --date 2026-09-30

The chart spec is documented in the skill's references/report-export.md.

Needs markdown-it-py. For the PDF it needs Playwright with Chromium
(pip install playwright && playwright install chromium), or a Chrome/Chromium binary,
or WeasyPrint as a last resort. Without any of them, the HTML is still written and prints
cleanly to PDF from a browser.
"""
import argparse
import base64
import csv
import datetime as dt
import glob
import html
import json
import math
import mimetypes
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

try:
    from markdown_it import MarkdownIt
except ImportError:
    sys.exit("Missing dependency: pip install markdown-it-py")

SKILL_DIR = Path(__file__).resolve().parent.parent
FONT_DIR = SKILL_DIR / "assets" / "fonts"

MONEY_DECIMALS = {"KWD": 3, "JOD": 3, "BHD": 3, "OMR": 3, "SAR": 2, "QAR": 2, "AED": 2,
                  "USD": 2, "EUR": 2, "GBP": 2, "EGP": 2}
ARABIC_RE = re.compile(r"[؀-ۿݐ-ݿ]")
LATIN_RE = re.compile(r"[A-Za-z]")
EASTERN_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")
MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
SERIES_VARS = ["--s1", "--s2", "--s3", "--s4"]  # validated categorical order; max 4 series
MAX_SERIES = 4


class SpecError(Exception):
    pass


# --------------------------------------------------------------------------- numbers

def to_num(v):
    if v is None:
        return None
    if isinstance(v, bool):
        return float(v)
    if isinstance(v, (int, float)):
        return None if (isinstance(v, float) and math.isnan(v)) else float(v)
    s = str(v).strip().translate(EASTERN_DIGITS).replace("−", "-").replace(",", "")
    s = s.replace("%", "").replace("pp", "")
    s = re.sub(r"[^\d.\-eE+]", "", s)
    if s in ("", "-", ".", "+"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def fmt(v, f="auto"):
    """Format a number. Percent formats take values already in percent units (9.7 -> 9.7%)."""
    if v is None:
        return "–"
    f = f or "auto"
    sign = f.endswith("+")
    base = f[:-1] if sign else f
    sp = "+" if sign else ""
    if base.startswith("money:"):
        cur = base.split(":", 1)[1].upper()
        d = MONEY_DECIMALS.get(cur, 2)
        return f"{v:{sp},.{d}f} {cur}"
    if base == "int":
        return f"{v:{sp},.0f}"
    if base in ("dec1", "dec2", "dec3"):
        return f"{v:{sp},.{base[-1]}f}"
    if base == "pct":
        return f"{v:{sp}.1f}%"
    if base == "pct0":
        return f"{v:{sp}.0f}%"
    if base == "pp":
        return f"{v:+.1f} pp"
    if base == "position":
        return f"{v:.2f}"
    if base == "compact":
        return compact(v, sign)
    if abs(v) >= 100 or float(v).is_integer():
        return f"{v:{sp},.0f}"
    return f"{v:{sp},.2f}"


def compact(v, sign=False):
    sp = "+" if sign else ""
    a = abs(v)
    for div, suf in ((1e9, "B"), (1e6, "M"), (1e3, "K")):
        if a >= div:
            s = f"{v / div:{sp}.1f}".replace(".0", "")
            return s + suf
    return f"{v:{sp},.0f}" if float(v).is_integer() else f"{v:{sp},.1f}"


def tick_fmt(v, f, span_max):
    if f and (f.startswith("money:") or f in ("pct", "pct0", "position", "dec1", "dec2")):
        if f.startswith("money:"):  # axis ticks carry no currency code; the title/subtitle names it
            return compact(v) if span_max >= 10000 else (f"{v:,.0f}" if float(v).is_integer() else f"{v:,.1f}")
        if f in ("pct", "pct0"):
            return f"{v:.0f}%" if float(v).is_integer() else f"{v:.1f}%"
        if f == "position":
            return f"{v:.0f}" if float(v).is_integer() else f"{v:.1f}"
        return f"{v:,.{f[-1]}f}"
    if span_max >= 10000:
        return compact(v)
    return f"{v:,.0f}" if float(v).is_integer() else f"{v:,.1f}"


def nice_ticks(lo, hi, n=5):
    if lo == hi:
        hi = lo + (abs(lo) or 1)
    span = hi - lo
    raw = span / max(n - 1, 1)
    mag = 10 ** math.floor(math.log10(raw))
    step = mag
    for m in (1, 2, 2.5, 5, 10):
        step = m * mag
        if span / step <= n - 1 + 1e-9:
            break
    start = math.floor(lo / step + 1e-9) * step
    end = math.ceil(hi / step - 1e-9) * step
    ticks, t = [], start
    while t <= end + step * 1e-6:
        ticks.append(round(t, 10))
        t += step
    return ticks


# --------------------------------------------------------------------------- dates

def parse_date(s):
    s = str(s).strip()
    for pat in ("%Y-%m-%d", "%Y%m%d", "%Y/%m/%d"):
        try:
            return dt.datetime.strptime(s, pat).date()
        except ValueError:
            pass
    return None


def date_label(d, lang):
    return f"{d.day}/{d.month}" if lang == "ar" else f"{d.day} {MONTHS_EN[d.month - 1]}"


# --------------------------------------------------------------------------- data

def read_csv_rows(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        lines = [l for l in f if l.strip() and not l.lstrip().startswith("#")]
    return list(csv.DictReader(lines))


def find_col(cols, name):
    if name in cols:
        return name
    low = {c.lower().strip(): c for c in cols}
    if name.lower().strip() in low:
        return low[name.lower().strip()]
    raise SpecError(f"column {name!r} not found; available: {cols}")


def load_data(spec, base_dir):
    """Return (x_labels, series[{name, values}]) from inline data or a CSV."""
    if "items" in spec:
        items = spec["items"]
        return ([str(i["label"]) for i in items],
                [{"name": spec.get("series_name", spec.get("y_label", "Value")),
                  "values": [to_num(i.get("value")) for i in items]}])
    if "csv" in spec:
        path = Path(spec["csv"])
        if not path.is_absolute():
            path = (base_dir / path)
        if not path.exists():
            raise SpecError(f"CSV not found: {path}")
        rows = read_csv_rows(path)
        if not rows:
            raise SpecError(f"CSV is empty: {path}")
        cols = list(rows[0].keys())
        for k, v in (spec.get("where") or {}).items():
            c = find_col(cols, k)
            allowed = {str(x) for x in (v if isinstance(v, list) else [v])}
            rows = [r for r in rows if str(r.get(c, "")).strip() in allowed]
        xcol = find_col(cols, spec["x"])
        ycols = spec["y"] if isinstance(spec["y"], list) else [spec["y"]]
        ycols = [find_col(cols, y) for y in ycols]
        names = spec.get("series_names") or ycols
        x = [str(r[xcol]).strip() for r in rows]
        series = [{"name": names[i], "values": [to_num(r[c]) for r in rows]} for i, c in enumerate(ycols)]
    else:
        x = [str(v) for v in spec.get("x", [])]
        series = [{"name": s.get("name", f"Series {i + 1}"), "values": [to_num(v) for v in s.get("values", [])]}
                  for i, s in enumerate(spec.get("series", []))]
        for s in series:
            if len(s["values"]) != len(x):
                raise SpecError(f"series {s['name']!r} has {len(s['values'])} values but x has {len(x)}")
    if not x or not series:
        raise SpecError("chart has no data")
    # chronological order for date axes
    dates = [parse_date(v) for v in x]
    if all(dates):
        order = sorted(range(len(x)), key=lambda i: dates[i])
        x = [x[i] for i in order]
        for s in series:
            s["values"] = [s["values"][i] for i in order]
    if spec.get("sort") in ("asc", "desc"):
        key = series[0]["values"]
        sign = -1 if spec["sort"] == "desc" else 1
        order = sorted(range(len(x)), key=lambda i: (key[i] is None, sign * (key[i] or 0)))
        x = [x[i] for i in order]
        for s in series:
            s["values"] = [s["values"][i] for i in order]
    if spec.get("limit"):
        n = int(spec["limit"])
        x = x[:n]
        for s in series:
            s["values"] = s["values"][:n]
    if len(series) > MAX_SERIES:
        raise SpecError(f"{len(series)} series; the limit is {MAX_SERIES}. Fold the rest into 'Other' or split the chart.")
    return x, series


# --------------------------------------------------------------------------- svg helpers

def esc(s):
    return html.escape(str(s), quote=True)


def text_w(s, size=11):
    """Rough rendered width; Arabic and Latin both ~0.56em average in Plex."""
    return len(str(s)) * size * 0.54


def truncate(s, max_px, size=11):
    s = str(s)
    if text_w(s, size) <= max_px:
        return s
    n = max(1, int(max_px / (size * 0.54)) - 1)
    return s[:n] + "…"


def wrap2(s, max_px, size=11):
    """Split a label over at most two lines, truncating the second if needed."""
    s = str(s)
    if text_w(s, size) <= max_px:
        return [s]
    words, line1 = s.split(), ""
    for i, w in enumerate(words):
        cand = (line1 + " " + w).strip()
        if text_w(cand, size) > max_px and line1:
            return [line1, truncate(" ".join(words[i:]), max_px, size)]
        line1 = cand
    return [truncate(s, max_px, size)]


def bar_path(x, y, w, h, r=4, end="top"):
    """Rect with 4px rounded data-end and a square base."""
    r = max(0.0, min(r, w / 2, abs(h)))
    if h <= 0:
        return ""
    if end == "top":
        return (f"M{x:.1f},{y + h:.1f} V{y + r:.1f} Q{x:.1f},{y:.1f} {x + r:.1f},{y:.1f} "
                f"H{x + w - r:.1f} Q{x + w:.1f},{y:.1f} {x + w:.1f},{y + r:.1f} V{y + h:.1f} Z")
    if end == "bottom":
        return (f"M{x:.1f},{y:.1f} V{y + h - r:.1f} Q{x:.1f},{y + h:.1f} {x + r:.1f},{y + h:.1f} "
                f"H{x + w - r:.1f} Q{x + w:.1f},{y + h:.1f} {x + w:.1f},{y + h - r:.1f} V{y:.1f} Z")
    if end == "right":
        return (f"M{x:.1f},{y:.1f} H{x + w - r:.1f} Q{x + w:.1f},{y:.1f} {x + w:.1f},{y + r:.1f} "
                f"V{y + h - r:.1f} Q{x + w:.1f},{y + h:.1f} {x + w - r:.1f},{y + h:.1f} H{x:.1f} Z")
    # left
    return (f"M{x + w:.1f},{y:.1f} H{x + r:.1f} Q{x:.1f},{y:.1f} {x:.1f},{y + r:.1f} "
            f"V{y + h - r:.1f} Q{x:.1f},{y + h:.1f} {x + r:.1f},{y + h:.1f} H{x + w:.1f} Z")


def legend_html(series, kind):
    if len(series) < 2:
        return ""
    items = []
    for i, s in enumerate(series):
        key = "key-line" if kind == "line" else "key-rect"
        items.append(f'<span class="lg-item"><span class="{key}" style="--c:var({SERIES_VARS[i]})"></span>{esc(s["name"])}</span>')
    return f'<div class="legend">{"".join(items)}</div>'


# --------------------------------------------------------------------------- charts

W = 720


def chart_line(spec, x, series, lang):
    H = int(spec.get("height", 300))
    yf = spec.get("format", "auto")
    vals = [v for s in series for v in s["values"] if v is not None]
    if not vals:
        raise SpecError("no numeric values")
    lo, hi = min(vals), max(vals)
    if spec.get("zero", yf != "position") and lo >= 0:
        lo = 0
    ticks = nice_ticks(lo, hi)
    lo, hi = ticks[0], ticks[-1]
    invert = bool(spec.get("invert_y", yf == "position"))
    labels = [tick_fmt(t, yf, max(abs(hi), abs(lo))) for t in ticks]
    ml = max(text_w(l, 11) for l in labels) + 14
    mr, mt, mb = 64, 22, 34
    pw, ph = W - ml - mr, H - mt - mb
    n = len(x)
    step = pw / max(n - 1, 1)

    def X(i):
        return ml + i * step

    def Y(v):
        frac = (v - lo) / (hi - lo)
        return mt + (frac if invert else 1 - frac) * ph

    out = [f'<svg class="chart-svg" viewBox="0 0 {W} {H}" role="img" aria-label="{esc(spec.get("title", "Line chart"))}" style="direction:ltr">']
    for t, l in zip(ticks, labels):
        y = Y(t)
        cls = "axis" if (t == 0 and not invert) else "grid"
        out.append(f'<line class="{cls}" x1="{ml}" x2="{W - mr}" y1="{y:.1f}" y2="{y:.1f}"/>')
        out.append(f'<text class="tick" x="{ml - 8}" y="{y + 4:.1f}" text-anchor="end">{esc(l)}</text>')
    # x ticks
    dates = [parse_date(v) for v in x]
    nlab = min(n, 7)
    idxs = sorted({round(i * (n - 1) / max(nlab - 1, 1)) for i in range(nlab)})
    for i in idxs:
        lab = date_label(dates[i], lang) if all(dates) else truncate(x[i], step * max(1, (n - 1) / max(nlab - 1, 1)) - 6)
        anchor = "start" if i == 0 and n > 1 else ("end" if i == n - 1 and n > 1 else "middle")
        out.append(f'<text class="tick" x="{X(i):.1f}" y="{H - mb + 18}" text-anchor="{anchor}">{esc(lab)}</text>')
    # annotations (solid hairline + label)
    for a in spec.get("annotations", []):
        ax = str(a.get("x"))
        if ax in x:
            i = x.index(ax)
            out.append(f'<line class="annot" x1="{X(i):.1f}" x2="{X(i):.1f}" y1="{mt - 6}" y2="{mt + ph}"/>')
            anchor = "end" if X(i) > ml + pw * 0.7 else "start"
            dx = -5 if anchor == "end" else 5
            out.append(f'<text class="annot-label" x="{X(i) + dx:.1f}" y="{mt + 4}" text-anchor="{anchor}">{esc(a.get("label", ""))}</text>')
    # series
    ends = []
    for si, s in enumerate(series):
        pts = [(X(i), Y(v)) for i, v in enumerate(s["values"]) if v is not None]
        if not pts:
            continue
        d = "M" + " L".join(f"{px:.1f},{py:.1f}" for px, py in pts)
        if len(series) == 1 and spec.get("area", False):
            out.append(f'<path class="area" d="{d} L{pts[-1][0]:.1f},{Y(lo if not invert else hi):.1f} L{pts[0][0]:.1f},{Y(lo if not invert else hi):.1f} Z" style="fill:var({SERIES_VARS[si]})"/>')
        out.append(f'<path class="line" d="{d}" style="stroke:var({SERIES_VARS[si]})"/>')
        lx, ly = pts[-1]
        out.append(f'<circle class="dot" cx="{lx:.1f}" cy="{ly:.1f}" r="4" style="fill:var({SERIES_VARS[si]})"/>')
        last = [v for v in s["values"] if v is not None][-1]
        ends.append((ly, fmt(last, yf)))
    # end labels only when they don't collide
    ys = sorted(e[0] for e in ends)
    if all(b - a >= 14 for a, b in zip(ys, ys[1:])):
        for ly, lab in ends:
            out.append(f'<text class="end-label" x="{W - mr + 8}" y="{ly + 4:.1f}">{esc(lab)}</text>')
    # hover layer
    out.append(f'<line class="crosshair" x1="0" x2="0" y1="{mt}" y2="{mt + ph}" visibility="hidden"/>')
    out.append(f'<rect class="hit" x="{ml}" y="{mt}" width="{pw}" height="{ph}" data-x0="{ml}" data-step="{step:.4f}" data-n="{n}"/>')
    out.append("</svg>")
    return "".join(out), "line"


def chart_bar(spec, x, series, lang):
    H = int(spec.get("height", 300))
    yf = spec.get("format", "auto")
    vals = [v for s in series for v in s["values"] if v is not None]
    lo, hi = min(0, min(vals)), max(0, max(vals))
    ticks = nice_ticks(lo, hi)
    lo, hi = ticks[0], ticks[-1]
    labels = [tick_fmt(t, yf, max(abs(hi), abs(lo))) for t in ticks]
    ml = max(text_w(l, 11) for l in labels) + 14
    mr, mt, mb = 16, 20, 46
    pw, ph = W - ml - mr, H - mt - mb
    n, k = len(x), len(series)
    band = pw / n
    bw = min(24, (band * 0.7) / k)
    gap = 2

    def Y(v):
        return mt + (1 - (v - lo) / (hi - lo)) * ph

    out = [f'<svg class="chart-svg" viewBox="0 0 {W} {H}" role="img" aria-label="{esc(spec.get("title", "Bar chart"))}" style="direction:ltr">']
    for t, l in zip(ticks, labels):
        out.append(f'<line class="{"axis" if t == 0 else "grid"}" x1="{ml}" x2="{W - mr}" y1="{Y(t):.1f}" y2="{Y(t):.1f}"/>')
        out.append(f'<text class="tick" x="{ml - 8}" y="{Y(t) + 4:.1f}" text-anchor="end">{esc(l)}</text>')
    hl = set(map(str, spec.get("highlight", [])))
    for i, lab in enumerate(x):
        gx = ml + i * band + (band - (bw * k + gap * (k - 1))) / 2
        for si, s in enumerate(series):
            v = s["values"][i]
            if v is None:
                continue
            bx = gx + si * (bw + gap)
            y0 = Y(0)
            color = f"var({SERIES_VARS[si]})" if (not hl or lab in hl) else "var(--dim)"
            if v >= 0:
                d = bar_path(bx, Y(v), bw, y0 - Y(v), end="top")
            else:
                d = bar_path(bx, y0, bw, Y(v) - y0, end="bottom")
            tip = f"{lab} · {s['name']}: {fmt(v, yf)}" if k > 1 else f"{lab}: {fmt(v, yf)}"
            out.append(f'<path class="mark" d="{d}" style="fill:{color}" data-i="{i}" data-s="{si}"><title>{esc(tip)}</title></path>')
            if k == 1 and n <= 12:
                ty = Y(v) - 6 if v >= 0 else Y(v) + 14
                out.append(f'<text class="value" x="{bx + bw / 2:.1f}" y="{ty:.1f}" text-anchor="middle">{esc(fmt(v, yf))}</text>')
        cx = ml + i * band + band / 2
        lines = wrap2(lab, band - 6)
        tsp = "".join(f'<tspan x="{cx:.1f}" dy="{0 if j == 0 else 13}">{esc(t)}</tspan>' for j, t in enumerate(lines))
        out.append(f'<text class="tick" x="{cx:.1f}" y="{H - mb + 17}" text-anchor="middle">{tsp}<title>{esc(lab)}</title></text>')
    out.append("</svg>")
    return "".join(out), "bar"


def chart_hbar(spec, x, series, lang):
    yf = spec.get("format", "auto")
    n, k = len(x), len(series)
    row = 30 if k == 1 else 22 + 12 * k
    mt, mb = 8, 8
    H = mt + mb + row * n
    vals = [v for s in series for v in s["values"] if v is not None]
    vmin, vmax = min(0, min(vals)), max(0, max(vals))
    diverging = vmin < 0 or spec.get("diverging", False)
    label_w = min(W * 0.42, max(text_w(l, 12) for l in x) + 22)
    val_w = max(text_w(fmt(v, yf), 11) for v in vals) + 10
    left_val = val_w if vmin < 0 else 0
    plot_x0 = label_w + left_val
    pw = W - plot_x0 - val_w - 8
    span = (vmax - vmin) or 1

    def P(v):
        return plot_x0 + (v - vmin) / span * pw

    base = P(0)
    hl = set(map(str, spec.get("highlight", [])))
    bh = min(16 if k == 1 else 10, 24)
    out = [f'<svg class="chart-svg" viewBox="0 0 {W} {H}" role="img" aria-label="{esc(spec.get("title", "Bar chart"))}" style="direction:ltr">']
    out.append(f'<line class="axis" x1="{base:.1f}" x2="{base:.1f}" y1="{mt}" y2="{H - mb}"/>')
    for i, lab in enumerate(x):
        ry = mt + i * row
        out.append(f'<text class="cat" x="{label_w - 10:.1f}" y="{ry + row / 2 + 4:.1f}" text-anchor="end">{esc(truncate(lab, label_w - 12, 12))}<title>{esc(lab)}</title></text>')
        for si, s in enumerate(series):
            v = s["values"][i]
            if v is None:
                continue
            by = ry + (row - (bh * k + 2 * (k - 1))) / 2 + si * (bh + 2)
            if diverging and k == 1:
                color = "var(--pos)" if v >= 0 else "var(--neg)"
            else:
                color = f"var({SERIES_VARS[si]})"
            if hl and lab not in hl:
                color = "var(--dim)"
            if v >= 0:
                d = bar_path(base, by, P(v) - base, bh, end="right")
                tx, anchor = P(v) + 6, "start"
            else:
                d = bar_path(P(v), by, base - P(v), bh, end="left")
                tx, anchor = P(v) - 6, "end"
            tip = f"{lab} · {s['name']}: {fmt(v, yf)}" if k > 1 else f"{lab}: {fmt(v, yf)}"
            out.append(f'<path class="mark" d="{d}" style="fill:{color}" data-i="{i}" data-s="{si}"><title>{esc(tip)}</title></path>')
            out.append(f'<text class="value" x="{tx:.1f}" y="{by + bh / 2 + 4:.1f}" text-anchor="{anchor}">{esc(fmt(v, yf))}</text>')
    out.append("</svg>")
    return "".join(out), "hbar"


def kpi_html(spec):
    tiles = []
    for it in spec.get("items", []):
        v = to_num(it.get("value"))
        f = it.get("format", "auto")
        if it.get("display"):
            value_html = esc(it["display"])
        elif f.startswith("money:"):
            num, cur = fmt(v, f).rsplit(" ", 1)
            value_html = f'{esc(num)} <span class="unit">{esc(cur)}</span>'
        else:
            value_html = esc(fmt(v, f))
        delta_html = ""
        if it.get("delta") is not None:
            d = to_num(it["delta"])
            df = it.get("delta_format", "pct+")
            good_up = it.get("good", "up") == "up"
            if d is None or d == 0:
                cls, arrow = "flat", "■"
            else:
                up = d > 0
                cls = "good" if up == good_up else "bad"
                arrow = "▲" if up else "▼"
            period = f' <span class="period">{esc(it["period"])}</span>' if it.get("period") else ""
            delta_html = f'<div class="delta {cls}"><span aria-hidden="true">{arrow}</span> {esc(fmt(d, df))}{period}</div>'
        note = f'<div class="note">{esc(it["note"])}</div>' if it.get("note") else ""
        tiles.append(f'<div class="tile"><div class="label">{esc(it.get("label", ""))}</div>'
                     f'<div class="value">{value_html}</div>{delta_html}{note}</div>')
    return f'<div class="kpis">{"".join(tiles)}</div>'


def data_table_html(x, series, yf):
    head = "".join(f"<th>{esc(s['name'])}</th>" for s in series)
    rows = "".join(f"<tr><td>{esc(lab)}</td>" + "".join(f'<td class="num">{esc(fmt(s["values"][i], yf))}</td>' for s in series) + "</tr>"
                   for i, lab in enumerate(x))
    return f'<table><thead><tr><th></th>{head}</tr></thead><tbody>{rows}</tbody></table>'


def render_chart(raw, base_dir, lang, counter, labels):
    try:
        spec = json.loads(raw)
    except json.JSONDecodeError as e:
        return f'<div class="chart-error">Chart spec is not valid JSON: {esc(e)}</div>', f"invalid JSON: {e}"
    title = spec.get("title", "")
    sub = spec.get("subtitle", "")
    src = spec.get("source", "")
    try:
        if spec.get("type") == "kpi":
            body = kpi_html(spec)
            return f'<div class="kpi-block">{body}' + (f'<div class="source">{esc(src)}</div>' if src else "") + "</div>", None
        x, series = load_data(spec, base_dir)
        kind = spec.get("type", "line")
        fn = {"line": chart_line, "bar": chart_bar, "hbar": chart_hbar}.get(kind)
        if not fn:
            raise SpecError(f"unknown chart type {kind!r} (use line, bar, hbar or kpi)")
        svg, mode = fn(spec, x, series, lang)
    except (SpecError, KeyError, ValueError, ZeroDivisionError) as e:
        return f'<div class="chart-error">Chart "{esc(title)}" could not be drawn: {esc(e)}</div>', f"{title}: {e}"
    counter[0] += 1
    cid = f"chart-{counter[0]:02d}"
    yf = spec.get("format", "auto")
    payload = {"mode": mode, "x": [date_label(parse_date(v), lang) if parse_date(v) else v for v in x],
               "series": [{"name": s["name"], "var": SERIES_VARS[i], "values": [fmt(v, yf) for v in s["values"]]}
                          for i, s in enumerate(series)]}
    data_json = json.dumps(payload, ensure_ascii=False).replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
    print_tables = " print-show" if len(series) >= 3 else ""
    return (f'<figure class="chart" id="{cid}" data-mode="{mode}">'
            + (f'<div class="chart-title">{esc(title)}</div>' if title else "")
            + (f'<div class="chart-sub">{esc(sub)}</div>' if sub else "")
            + legend_html(series, mode)
            + f'<div class="plot">{svg}<div class="tip" hidden></div></div>'
            + (f'<figcaption class="source">{esc(labels["source"])}: {esc(src)}</figcaption>' if src else "")
            + f'<details class="chart-data{print_tables}"><summary>{esc(labels["data"])}</summary>{data_table_html(x, series, yf)}</details>'
            + f'<script type="application/json" class="chart-json">{data_json}</script></figure>'), None


# --------------------------------------------------------------------------- markdown

def slugify(s, used):
    """Short ASCII ids: long Unicode ids bloat PDF named destinations."""
    s = re.sub(r"[^a-z0-9\s-]", "", s.lower()).strip()
    s = re.sub(r"[\s_-]+", "-", s).strip("-")[:40] or f"sec-{len(used) + 1}"
    base, i = s, 2
    while s in used:
        s, i = f"{base}-{i}", i + 1
    used.add(s)
    return s


NUM_CELL = re.compile(
    r"^\s*(?:about\s+|~|≈)?[+\-−–]?\s*[\d٠-٩][\d٠-٩.,]*\s*(?:%|pp|K|M|×|x)?"
    r"(?:\s*(?:KWD|JOD|SAR|QAR|AED|BHD|OMR|USD|د\.ك|د\.أ|ر\.س|ر\.ق))?"
    r"(?:\s*(?:→|->|to)\s*[+\-−–]?\s*[\d٠-٩][\d٠-٩.,]*\s*(?:%|pp|K|M)?(?:\s*(?:KWD|JOD|SAR|QAR|AED|BHD|OMR|USD))?)?"
    r"(?:\s*\([^)]{0,24}\))?\s*$", re.I)
SEVERITY = {"critical": "critical", "high": "high", "medium": "medium", "low": "low",
            "حرج": "critical", "حرجة": "critical", "عالي": "high", "عالية": "high", "مرتفع": "high", "مرتفعة": "high",
            "متوسط": "medium", "متوسطة": "medium", "منخفض": "low", "منخفضة": "low"}


def post_process(body):
    def td(m):
        attrs, inner = m.group(1) or "", m.group(2)
        text = html.unescape(re.sub(r"<[^>]+>", "", inner)).strip()
        key = text.lower().strip("*_ ")
        if key in SEVERITY:
            return f'<td{attrs}><span class="sev sev-{SEVERITY[key]}">{inner}</span></td>'
        if text and NUM_CELL.match(text):
            return f'<td class="num"{attrs}><span class="n">{inner}</span></td>'
        return m.group(0)
    body = re.sub(r"<td([^>]*)>(.*?)</td>", td, body, flags=re.S)
    body = re.sub(r"<(em|strong)>(Verified|Inferred|Not verified)</\1>",
                  lambda m: f'<span class="vtag vtag-{m.group(2).lower().replace(" ", "-")}">{m.group(2)}</span>', body)
    body = re.sub(r"<(p|li)>(\s*(?:<strong>)?ASSUMPTION:(?:</strong>)?)",
                  lambda m: f'<{m.group(1)} class="assumption">{m.group(2)}', body)
    return body


def embed_images(body, base_dir, warnings):
    def rep(m):
        src = html.unescape(m.group(2))
        if re.match(r"^(https?:|data:)", src):
            return m.group(0)
        p = (base_dir / src).resolve()
        if not p.exists() or p.stat().st_size > 8_000_000:
            warnings.append(f"image not embedded: {src}")
            return m.group(0)
        mime = mimetypes.guess_type(str(p))[0] or "application/octet-stream"
        if not mime.startswith("image/"):
            return m.group(0)
        data = base64.b64encode(p.read_bytes()).decode()
        return f'{m.group(1)}data:{mime};base64,{data}{m.group(3)}'
    return re.sub(r'(<img[^>]*?src=")([^"]+)(")', rep, body)


def render_markdown(text, base_dir, lang, labels, warnings):
    md = MarkdownIt("commonmark", {"html": False, "linkify": False, "typographer": False}).enable(["table", "strikethrough"])
    counter = [0]
    default_fence = md.renderer.rules.get("fence")

    def fence(self, tokens, idx, options, env):
        tok = tokens[idx]
        if tok.info.strip().lower() == "chart":
            out, err = render_chart(tok.content, base_dir, lang, counter, labels)
            if err:
                warnings.append(f"chart error: {err}")
            return out
        return default_fence(tokens, idx, options, env)

    md.add_render_rule("fence", fence)
    md.add_render_rule("table_open", lambda self, t, i, o, e: '<div class="table-wrap"><table>\n')
    md.add_render_rule("table_close", lambda self, t, i, o, e: "</table></div>\n")

    tokens = md.parse(text)
    used, toc, title = set(), [], None
    drop = None
    for i, t in enumerate(tokens):
        if t.type == "heading_open":
            inline = tokens[i + 1]
            label = re.sub(r"[*_`]", "", inline.content).strip()
            if t.tag == "h1" and title is None:
                title = label
                drop = i
                continue
            sid = slugify(label, used)
            t.attrSet("id", sid)
            if t.tag == "h2":
                toc.append((sid, label))
    if drop is not None:
        tokens = tokens[:drop] + tokens[drop + 3:]
    body = md.renderer.render(tokens, md.options, {})
    body = post_process(body)
    body = embed_images(body, base_dir, warnings)
    return title, toc, body, counter[0]


# --------------------------------------------------------------------------- page

def font_css():
    faces = []
    ranges = {
        "arabic": "U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC",
        "latin": "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
    }
    for subset, rng in ranges.items():
        for weight in (400, 600):
            f = FONT_DIR / f"ibm-plex-sans-arabic-{subset}-{weight}-normal.woff2"
            if f.exists():
                b64 = base64.b64encode(f.read_bytes()).decode()
                faces.append(f"@font-face{{font-family:'Report Sans';font-style:normal;font-weight:{weight};"
                             f"font-display:swap;src:url(data:font/woff2;base64,{b64}) format('woff2');unicode-range:{rng};}}")
    return "\n".join(faces)


CSS = r"""
:root{
  color-scheme: light;
  --page:#f9f9f7; --surface:#fcfcfb; --ink:#0b0b0b; --ink-2:#52514e; --muted:#6f6e69;
  --grid:#e1e0d9; --axis:#c3c2b7; --border:rgba(11,11,11,.10); --thead:#f0efec; --zebra:#f6f5f2;
  --s1:#2a78d6; --s2:#eb6834; --s3:#1baf7a; --s4:#eda100; --pos:#2a78d6; --neg:#e34948; --dim:#c3c2b7;
  --good:#006300; --bad:#c23434; --link:#1c5cab; --callout:#f0efec; --annot:#898781;
  --sev-critical:#d03b3b; --sev-high:#ec835a; --sev-medium:#fab219; --sev-low:#a8a69f;
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    color-scheme: dark;
    --page:#0d0d0d; --surface:#1a1a19; --ink:#ffffff; --ink-2:#c3c2b7; --muted:#a3a198;
    --grid:#2c2c2a; --axis:#383835; --border:rgba(255,255,255,.10); --thead:#242422; --zebra:#1f1f1e;
    --s1:#3987e5; --s2:#d95926; --s3:#199e70; --s4:#c98500; --pos:#3987e5; --neg:#e66767; --dim:#4a4946;
    --good:#0ca30c; --bad:#e66767; --link:#86b6ef; --callout:#242422; --annot:#898781;
  }
}
:root[data-theme="dark"]{
  color-scheme: dark;
  --page:#0d0d0d; --surface:#1a1a19; --ink:#ffffff; --ink-2:#c3c2b7; --muted:#a3a198;
  --grid:#2c2c2a; --axis:#383835; --border:rgba(255,255,255,.10); --thead:#242422; --zebra:#1f1f1e;
  --s1:#3987e5; --s2:#d95926; --s3:#199e70; --s4:#c98500; --pos:#3987e5; --neg:#e66767; --dim:#4a4946;
  --good:#0ca30c; --bad:#e66767; --link:#86b6ef; --callout:#242422; --annot:#898781;
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--page);color:var(--ink);
  font-family:'Report Sans',system-ui,-apple-system,'Segoe UI','Noto Sans Arabic',Tahoma,sans-serif;
  font-size:15px;line-height:1.65;}
main{max-width:920px;margin:24px auto;padding:40px 48px;background:var(--surface);
  border:1px solid var(--border);border-radius:12px;overflow-wrap:break-word}
main :is(p,li,blockquote) :is(code,a){overflow-wrap:anywhere}
td :is(code,a){overflow-wrap:break-word}
@media (max-width:720px){ main{margin:0;padding:20px 16px;border:0;border-radius:0} body{font-size:14.5px} }
header.report-head{border-bottom:1px solid var(--grid);padding-bottom:18px;margin-bottom:8px}
header.report-head h1{font-size:28px;line-height:1.3;margin:0 0 6px;font-weight:600}
.meta{color:var(--ink-2);font-size:13.5px}
nav.toc{margin:18px 0 8px;padding:14px 18px;background:var(--callout);border-radius:8px;font-size:13.5px}
nav.toc strong{display:block;margin-bottom:4px}
nav.toc ul{margin:0;padding:0;list-style:none;columns:2;column-gap:28px}
nav.toc li{margin:.15em 0;break-inside:avoid}
@media (max-width:720px){ nav.toc ul{columns:1} }
nav.toc a{color:var(--ink);text-decoration:none} nav.toc a:hover{text-decoration:underline}
h2{font-size:21px;line-height:1.35;margin:2.1em 0 .6em;padding-top:.8em;border-top:1px solid var(--grid);font-weight:600}
h3{font-size:17px;margin:1.6em 0 .5em;font-weight:600}
h4{font-size:15px;margin:1.3em 0 .4em;font-weight:600}
p,ul,ol{margin:.6em 0}
li{margin:.25em 0}
a{color:var(--link)}
strong{font-weight:600}
code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.88em;background:var(--callout);
  padding:.1em .35em;border-radius:4px;direction:ltr;unicode-bidi:isolate}
pre{background:var(--callout);padding:12px 14px;border-radius:8px;overflow-x:auto;direction:ltr;text-align:left;font-size:12.5px}
pre code{background:none;padding:0}
blockquote{margin:1em 0;padding:10px 16px;background:var(--callout);border-inline-start:3px solid var(--axis);border-radius:6px}
blockquote p{margin:.3em 0}
hr{border:0;border-top:1px solid var(--grid);margin:2em 0}
hr:has(+ h2),header.report-head + hr{display:none}
img{max-width:100%;height:auto;border-radius:6px}
.table-wrap{overflow-x:auto;margin:1em 0;border:1px solid var(--grid);border-radius:8px}
table{border-collapse:collapse;width:100%;font-size:13.5px;line-height:1.45}
th,td{padding:7px 10px;text-align:start;vertical-align:top;border-bottom:1px solid var(--grid)}
thead th{background:var(--thead);font-weight:600;white-space:nowrap}
tbody tr:nth-child(even) td{background:var(--zebra)}
tbody tr:last-child td{border-bottom:0}
td.num{text-align:end;font-variant-numeric:tabular-nums;white-space:nowrap}
td.num .n{direction:ltr;unicode-bidi:isolate}
.sev{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.sev::before{content:"";width:9px;height:9px;border-radius:50%;background:var(--c)}
.sev-critical{--c:var(--sev-critical)} .sev-high{--c:var(--sev-high)} .sev-medium{--c:var(--sev-medium)} .sev-low{--c:var(--sev-low)}
.vtag{display:inline-block;font-size:.8em;font-weight:600;padding:0 .5em;border-radius:999px;border:1px solid var(--axis);color:var(--ink-2);white-space:nowrap}
.assumption{background:var(--callout);border-inline-start:3px solid var(--axis);padding:6px 12px;border-radius:6px;list-style:none}
figure.chart,.kpi-block{margin:1.6em 0;padding:16px 18px 12px;border:1px solid var(--grid);border-radius:10px;background:var(--surface)}
.chart-title{font-weight:600;font-size:15px}
.chart-sub{color:var(--ink-2);font-size:13px;margin-top:2px}
.legend{display:flex;flex-wrap:wrap;gap:6px 16px;margin:10px 0 2px;font-size:12.5px;color:var(--ink-2)}
.lg-item{display:inline-flex;align-items:center;gap:6px}
.key-line{width:16px;height:2px;border-radius:1px;background:var(--c)}
.key-rect{width:10px;height:10px;border-radius:2px;background:var(--c)}
.plot{position:relative;margin-top:8px}
.chart-svg{width:100%;height:auto;display:block;overflow:visible}
.chart-svg text{font-family:inherit;fill:var(--muted);font-size:11px}
.chart-svg text.cat{fill:var(--ink-2);font-size:12px}
.chart-svg text.value,.chart-svg text.end-label{fill:var(--ink-2);font-size:11px;font-variant-numeric:tabular-nums}
.chart-svg text.annot-label{fill:var(--ink-2);font-size:11px}
.chart-svg .grid{stroke:var(--grid);stroke-width:1}
.chart-svg .axis{stroke:var(--axis);stroke-width:1}
.chart-svg .annot{stroke:var(--annot);stroke-width:1}
.chart-svg .line{fill:none;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.chart-svg .area{opacity:.1}
.chart-svg .dot{stroke:var(--surface);stroke-width:2}
.chart-svg .crosshair{stroke:var(--axis);stroke-width:1}
.chart-svg .hit{fill:transparent;cursor:crosshair}
.chart-svg .mark{transition:opacity .12s}
.chart-svg .mark:hover{opacity:.8}
.tip{position:absolute;pointer-events:none;background:var(--surface);color:var(--ink);border:1px solid var(--border);
  box-shadow:0 4px 16px rgba(0,0,0,.12);border-radius:8px;padding:8px 10px;font-size:12.5px;min-width:120px;z-index:5}
.tip .tip-x{color:var(--ink-2);font-size:12px;margin-bottom:4px}
.tip .row{display:flex;align-items:center;gap:8px;justify-content:space-between}
.tip .row .k{display:inline-flex;align-items:center;gap:6px;color:var(--ink-2)}
.tip .row .k i{width:12px;height:2px;border-radius:1px;background:var(--c);display:inline-block}
.tip .row b{font-weight:600;font-variant-numeric:tabular-nums}
.source{color:var(--muted);font-size:12px;margin-top:6px}
details.chart-data{margin-top:6px;font-size:12.5px}
details.chart-data summary{cursor:pointer;color:var(--ink-2)}
details.chart-data table{margin-top:6px;font-size:12.5px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}
.tile{border:1px solid var(--grid);border-radius:10px;padding:12px 14px;background:var(--surface)}
.tile .label{color:var(--ink-2);font-size:12.5px}
.tile .value{font-size:24px;font-weight:600;line-height:1.3;margin-top:2px}
.tile .value .unit{font-size:13px;font-weight:600;color:var(--ink-2)}
.tile .delta{font-size:12.5px;margin-top:2px;font-variant-numeric:tabular-nums}
.tile .delta.good{color:var(--good)} .tile .delta.bad{color:var(--bad)} .tile .delta.flat{color:var(--ink-2)}
.tile .delta .period,.tile .note{color:var(--muted)}
.tile .note{font-size:12px;margin-top:2px}
.chart-error{border:1px solid var(--bad);color:var(--bad);border-radius:8px;padding:8px 12px;margin:1em 0;font-size:13px}
footer.report-foot{margin-top:40px;padding-top:12px;border-top:1px solid var(--grid);color:var(--muted);font-size:12px}
@media print{
  :root,:root:not([data-theme="light"]),:root[data-theme="dark"]{
    color-scheme: light;
    --page:#ffffff; --surface:#ffffff; --ink:#0b0b0b; --ink-2:#52514e; --muted:#6f6e69;
    --grid:#e1e0d9; --axis:#c3c2b7; --border:rgba(11,11,11,.10); --thead:#f0efec; --zebra:#f7f6f3;
    --s1:#2a78d6; --s2:#eb6834; --s3:#1baf7a; --s4:#eda100; --pos:#2a78d6; --neg:#e34948; --dim:#c3c2b7;
    --good:#006300; --bad:#c23434; --link:#1c5cab; --callout:#f3f2ee; --annot:#898781;
  }
  @page{size:A4;margin:16mm 14mm 18mm}
  body{font-size:10.5pt;line-height:1.55;background:#fff}
  main{max-width:none;margin:0;padding:0;border:0;border-radius:0}
  header.report-head h1{font-size:21pt}
  h2{font-size:15pt;break-after:avoid;page-break-after:avoid}
  h3,h4{break-after:avoid;page-break-after:avoid}
  figure.chart,.kpi-block,.kpis,.tile,blockquote,pre{break-inside:avoid;page-break-inside:avoid}
  .table-wrap{overflow:visible;border-radius:0}
  table{font-size:8.8pt}
  thead{display:table-header-group}
  tr{break-inside:avoid;page-break-inside:avoid}
  td.num{white-space:normal}
  .tip,.crosshair{display:none!important}
  details.chart-data{display:none}
  details.chart-data.print-show{display:block}
  details.chart-data.print-show summary{display:none}
  a{text-decoration:none;color:inherit}
  nav.toc{break-inside:avoid}
  footer.report-foot{display:none}
}
"""

JS = r"""
(function(){
  function el(tag, cls, text){ var e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; }
  document.querySelectorAll('figure.chart').forEach(function(fig){
    var js=fig.querySelector('script.chart-json'); if(!js) return;
    var data; try{ data=JSON.parse(js.textContent); }catch(e){ return; }
    var svg=fig.querySelector('svg'), tip=fig.querySelector('.tip'), plot=fig.querySelector('.plot');
    function place(evt){
      var r=plot.getBoundingClientRect(), x=evt.clientX-r.left, y=evt.clientY-r.top;
      tip.hidden=false;
      var w=tip.offsetWidth, h=tip.offsetHeight;
      var left=Math.min(Math.max(8, x+14), r.width-w-8); if(x+14+w>r.width) left=Math.max(8, x-w-14);
      tip.style.left=left+'px'; tip.style.top=Math.max(0, y-h-10)+'px';
    }
    function fill(xLabel, rows){
      tip.textContent=''; tip.appendChild(el('div','tip-x',xLabel));
      rows.forEach(function(rw){
        var row=el('div','row'), k=el('span','k'), key=el('i');
        key.style.setProperty('--c','var('+rw.v+')'); k.appendChild(key); k.appendChild(document.createTextNode(rw.name));
        row.appendChild(k); row.appendChild(el('b',null,rw.val)); tip.appendChild(row);
      });
    }
    if(data.mode==='line'){
      var hit=svg.querySelector('.hit'), cross=svg.querySelector('.crosshair');
      var x0=+hit.dataset.x0, step=+hit.dataset.step, n=+hit.dataset.n;
      hit.addEventListener('pointermove', function(evt){
        var pt=svg.createSVGPoint(); pt.x=evt.clientX; pt.y=evt.clientY;
        var p=pt.matrixTransform(svg.getScreenCTM().inverse());
        var i=Math.round((p.x-x0)/(step||1)); i=Math.max(0,Math.min(n-1,i));
        var cx=x0+i*step; cross.setAttribute('x1',cx); cross.setAttribute('x2',cx); cross.setAttribute('visibility','visible');
        fill(data.x[i], data.series.map(function(s){ return {name:s.name, v:s.var, val:s.values[i]}; }));
        place(evt);
      });
      hit.addEventListener('pointerleave', function(){ tip.hidden=true; cross.setAttribute('visibility','hidden'); });
    } else {
      svg.querySelectorAll('.mark').forEach(function(m){
        m.addEventListener('pointermove', function(evt){
          var i=+m.dataset.i, s=+m.dataset.s, ser=data.series[s];
          fill(data.x[i], [{name:ser.name, v:ser.var, val:ser.values[i]}]); place(evt);
        });
        m.addEventListener('pointerleave', function(){ tip.hidden=true; });
      });
    }
  });
})();
"""

LABELS = {
    "en": {"contents": "Contents", "source": "Source", "data": "Data table", "generated": "Report date",
           "built": "Built from the report's Markdown source; figures come from the files and observations listed in the report."},
    "ar": {"contents": "المحتويات", "source": "المصدر", "data": "جدول البيانات", "generated": "تاريخ التقرير",
           "built": "أُعدّت هذه الصفحة من ملف Markdown للتقرير؛ الأرقام مأخوذة من الملفات والملاحظات المذكورة فيه."},
}


def detect_lang(text):
    t = re.sub(r"```.*?```", "", text, flags=re.S)
    ar, la = len(ARABIC_RE.findall(t)), len(LATIN_RE.findall(t))
    return "ar" if ar > 0.35 * (ar + la) else "en"


def build_html(md_path, lang, subtitle, date_str, warnings):
    text = Path(md_path).read_text(encoding="utf-8")
    base_dir = Path(md_path).resolve().parent
    lang = lang or detect_lang(text)
    labels = LABELS["ar" if lang == "ar" else "en"]
    title, toc, body, n_charts = render_markdown(text, base_dir, lang, labels, warnings)
    title = title or Path(md_path).stem
    dir_ = "rtl" if lang == "ar" else "ltr"
    toc_html = ""
    if len(toc) >= 3:
        items = "".join(f'<li><a href="#{esc(sid)}">{esc(lab)}</a></li>' for sid, lab in toc)
        toc_html = f'<nav class="toc" aria-label="{esc(labels["contents"])}"><strong>{esc(labels["contents"])}</strong><ul>{items}</ul></nav>'
    meta_bits = []
    if subtitle:
        meta_bits.append(esc(subtitle))
    meta_bits.append(f'{esc(labels["generated"])}: {esc(date_str)}')
    page = f"""<!doctype html>
<html lang="{lang}" dir="{dir_}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<style>
{font_css()}
{CSS}
</style>
</head>
<body>
<main>
<header class="report-head">
<h1>{esc(title)}</h1>
<div class="meta">{" · ".join(meta_bits)}</div>
{toc_html}
</header>
{body}
<footer class="report-foot">{esc(labels["built"])}</footer>
</main>
<script>{JS}</script>
</body>
</html>
"""
    return page, title, n_charts


# --------------------------------------------------------------------------- pdf

def find_chrome():
    for env in ("CHROME_PATH", "CHROMIUM_PATH"):
        if os.environ.get(env) and Path(os.environ[env]).exists():
            return os.environ[env]
    for name in ("chromium", "chromium-browser", "google-chrome", "google-chrome-stable", "chrome"):
        p = shutil.which(name)
        if p:
            return p
    for pat in ("/opt/pw-browsers/chromium-*/chrome-linux/chrome", os.path.expanduser("~/.cache/ms-playwright/chromium-*/chrome-linux/chrome"),
                "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"):
        hits = sorted(glob.glob(pat))
        if hits:
            return hits[-1]
    return None


def footer_template(title):
    t = esc(title if len(title) <= 90 else title[:88].rstrip() + "…")
    return (f'<div style="font-size:7.5px;width:100%;padding:0 14mm;color:#6f6e69;display:flex;'
            f'justify-content:space-between;font-family:sans-serif"><span>{t}</span>'
            f'<span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>')


def pdf_with_playwright(html_path, pdf_path, title, png_dir, stem):
    from playwright.sync_api import sync_playwright
    pngs = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(device_scale_factor=2, viewport={"width": 1000, "height": 1400})
        page = ctx.new_page()
        page.goto(Path(html_path).resolve().as_uri(), wait_until="load")
        page.evaluate("document.fonts.ready")
        if png_dir is not None:
            page.evaluate("document.documentElement.setAttribute('data-theme','light')")
            figs = page.query_selector_all("figure.chart, .kpi-block")
            if figs:
                png_dir.mkdir(parents=True, exist_ok=True)
            for i, f in enumerate(figs, 1):
                out = png_dir / f"{stem}-chart-{i:02d}.png"
                f.screenshot(path=str(out))
                pngs.append(out)
        page.emulate_media(media="print")
        page.pdf(path=str(pdf_path), format="A4", print_background=True,
                 margin={"top": "16mm", "bottom": "18mm", "left": "14mm", "right": "14mm"},
                 display_header_footer=True, header_template="<span></span>",
                 footer_template=footer_template(title))
        browser.close()
    return "playwright-chromium", pngs


def pdf_with_chrome_cli(html_path, pdf_path):
    chrome = find_chrome()
    if not chrome:
        raise RuntimeError("no Chrome/Chromium binary found")
    cmd = [chrome, "--headless=new", "--disable-gpu", "--no-sandbox", "--no-pdf-header-footer",
           f"--print-to-pdf={pdf_path}", Path(html_path).resolve().as_uri()]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if not Path(pdf_path).exists():
        raise RuntimeError(f"chrome failed: {r.stderr[-400:]}")
    return "chrome-cli"


def pdf_with_weasyprint(html_path, pdf_path):
    import weasyprint  # noqa
    weasyprint.HTML(filename=str(html_path)).write_pdf(str(pdf_path))
    return "weasyprint"


def make_pdf(html_path, pdf_path, title, png_dir, stem, errors):
    try:
        return pdf_with_playwright(html_path, pdf_path, title, png_dir, stem)
    except Exception as e:  # noqa: BLE001  (fall through to the next engine)
        errors.append(f"playwright: {type(e).__name__}: {str(e)[:200]}")
    for fn in (pdf_with_chrome_cli, pdf_with_weasyprint):
        try:
            return fn(html_path, pdf_path), []
        except Exception as e:  # noqa: BLE001
            errors.append(f"{fn.__name__}: {type(e).__name__}: {str(e)[:200]}")
    return None, []


# --------------------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("markdown", help="report Markdown file")
    ap.add_argument("--out-dir", help="output folder (default: next to the Markdown file)")
    ap.add_argument("--name", help="output file name without extension (default: Markdown file name)")
    ap.add_argument("--lang", choices=["ar", "en"], help="force language/direction (default: auto-detect)")
    ap.add_argument("--subtitle", default="", help="line under the title, e.g. client and market")
    ap.add_argument("--date", default=dt.date.today().isoformat(), help="report date shown in the header")
    ap.add_argument("--no-pdf", action="store_true")
    ap.add_argument("--no-png", action="store_true", help="skip per-chart PNG export")
    a = ap.parse_args()

    md_path = Path(a.markdown)
    out_dir = Path(a.out_dir) if a.out_dir else md_path.resolve().parent
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = a.name or md_path.stem
    warnings = []
    page, title, n_charts = build_html(md_path, a.lang, a.subtitle, a.date, warnings)
    html_path = out_dir / f"{stem}.html"
    html_path.write_text(page, encoding="utf-8")
    print(f"HTML: {html_path} ({len(page) // 1024} KB, {n_charts} charts)")
    if not a.no_pdf:
        errors = []
        pdf_path = out_dir / f"{stem}.pdf"
        engine, pngs = make_pdf(html_path, pdf_path, title, None if a.no_png else out_dir / "charts", stem, errors)
        if engine:
            print(f"PDF:  {pdf_path} (engine: {engine})")
            for p in pngs:
                print(f"PNG:  {p}")
        else:
            print("PDF:  not created. No PDF engine worked; open the HTML in a browser and print to PDF (print styles are built in).")
            for e in errors:
                print(f"      {e}")
    for w in warnings:
        print(f"WARNING: {w}")
    if any(w.startswith("chart error") for w in warnings):
        sys.exit(2)


if __name__ == "__main__":
    main()
