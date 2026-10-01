# Report export: HTML page and PDF with charts and tables

Every report is written once, as Markdown, and exported three ways:

- the report document in the host's format;
- a self-contained **HTML page**;
- a **PDF**.

`scripts/build_report.py` produces the HTML, the PDF and a PNG of each chart from the same Markdown file, so all three versions show the same numbers.

## Run it

```bash
python scripts/build_report.py outputs/report.md --out-dir outputs/ \
  --subtitle "Client · Market · Prepared for …" --date 2026-09-30
```

It writes:

- `report.html`: one file with fonts, charts and images embedded. It works offline, as an email attachment, and in light or dark mode. It has hover tooltips and a table of contents.
- `report.pdf`: A4 with page numbers. Table headers repeat on each page, and charts and table rows are never split across pages.
- `charts/report-chart-NN.png`: one image per chart and KPI block, ready to insert into a Docs artifact or a `.docx`.

**Language and direction.** Arabic reports are detected automatically and laid out right-to-left. Force it with `--lang ar` or `--lang en`. Charts stay left-to-right, with numbers and time running left to right, while their Arabic titles and labels render correctly.

**PDF engines.** The script uses Playwright's Chromium, then any Chrome/Chromium binary, then WeasyPrint. If none is available, deliver the HTML and tell the user to print it to PDF from a browser, since the print styles are built in. Don't claim a PDF exists unless the script reports one.

**Exit codes.** The script exits with code 2 if any chart failed to draw. The failed chart appears as a red box in the output. Fix the spec and rebuild; never ship a report with a chart error box.

## Tables

Write normal Markdown pipe tables. The builder handles the styling:

- **Numbers** are right-aligned with tabular figures. That includes cells like `2,336 → 530`, `−3.1%` and `4,489.628 JOD`.
- **Severity** is marked when a cell reads exactly `Critical`, `High`, `Medium` or `Low` (or حرج / مرتفع / متوسط / منخفض). The cell gets a colored dot, and the label still carries the meaning.
- **Verification tags** in italics or bold (`*Verified*`, `*Inferred*`, `*Not verified*`) become small pills.
- **Assumptions**: paragraphs or list items starting with `ASSUMPTION:` get a callout style.

Keep tables readable on A4 portrait. About 7 columns is the practical maximum. If a table is wider, split it or move the full version to an attached CSV.

## Charts

Add a chart with a fenced code block whose language is `chart` and whose body is a JSON spec:

````markdown
```chart
{"type": "line", "title": "Daily clicks from Google search",
 "subtitle": "Site-wide, web search, 1 Jul – 31 Aug 2026 (Pacific Time)",
 "csv": "gsc_dates_daily.csv", "x": "Date", "y": "Clicks", "format": "int",
 "annotations": [{"x": "2026-08-12", "label": "12 Aug: step down"}],
 "source": "Search Console Dates export (gsc_dates_daily.csv)"}
```
````

### Where the data comes from

- `"csv"`: a CSV path relative to the Markdown file. `"x"` names the label column. `"y"` is a column name or a list of up to 4. Lines starting with `#` are skipped, so GA4 exports load as they are.
  - `"series_names"` renames the legend entries.
  - `"where": {"Year month": "202608"}` filters rows.
  - `"sort": "asc"` or `"desc"` sorts by the first series.
  - `"limit": 10` keeps the first rows.
  - Date columns (`2026-08-12` or `20260812`) are sorted chronologically automatically.
- **Inline data**: `"x": [...]` with `"series": [{"name": "...", "values": [...]}]`. For a single series you can use `"items": [{"label": "...", "value": 12}]` instead.

Prefer `"csv"` pointing at the file you actually analyzed. The chart is then traceable to the same evidence as the tables, and nobody retypes numbers by hand.

### Chart types

| `type` | Use it for | Notes |
|---|---|---|
| `line` | Trends over time: daily clicks, impressions, position | Up to 4 series. `annotations` draws a hairline and a label at an x value, such as a release date or a Google update. For position, `"format": "position"` inverts the axis so up means better. `"area": true` adds a light fill for a single series. |
| `bar` | Comparing a few categories, or before vs after (e.g. July vs August by cluster) | Up to about 8 categories and 3 series. The y-axis always starts at zero. Long category names wrap onto two lines; if they're longer still, use `hbar`. |
| `hbar` | Ranked lists with long labels: pages, queries, domains; changes that can be negative | Negative values make it a diverging chart (blue up, red down). `"highlight": ["label"]` shows the story item in color and the rest in gray. |
| `kpi` | The 3–5 headline numbers at the top of the summary | Takes `items` with `label`, `value`, `format`, and optionally `delta`, `delta_format`, `period`, and `good` (`"up"` or `"down"`, the direction that counts as good), plus a `note`. |

### Common options

- `title`: states what the chart shows.
- `subtitle`: scope, period and timezone.
- `source`: the file or export behind the chart.
- `format`: how numbers display. Options:
  - `int`
  - `dec1`, `dec2`
  - `pct` (values already in percent units, e.g. `9.7`)
  - `pp`
  - `position`
  - `compact`
  - `money:JOD`, `money:KWD`, `money:SAR` and so on. KWD, JOD and BHD show 3 decimals; SAR, QAR and AED show 2.

  Add `+` to force a sign, for example `int+` or `pct+`.
- `height`: the height of line and bar charts, in pixels.

## What to chart, and the honesty rules

A chart should earn its place. Use one when the shape of the data is the finding, such as a step change, a single page dominating a drop, or one domain type owning the results. Otherwise a table or a sentence is better.

Typical charts for each job:

| Job | Charts that usually earn their place |
|---|---|
| Performance report | KPI tiles (clicks, orders, revenue, the key page's position). A daily `line` with the change date annotated. An `hbar` of click change by page. A `bar` of clicks by cluster, before vs after. |
| Site audit | An `hbar` or `bar` of issue counts by severity or by template, but only with a real crawl or export count behind it. A KPI row of crawl totals (URLs checked, indexable, errors). |
| Keyword and competitor research | An `hbar` of how many tested queries each domain appears in. A `bar` of SERP page types (clinic site, social, directory…) by language. Never chart search volume without an export. |
| AI visibility (AEO / GEO) | A `bar` of mention or citation rate by engine, or share of voice against competitors, only from an observed prompt panel. Put n (runs) in the subtitle. The readiness scorecard and crawler access belong in tables, not charts. |

Rules that apply to every chart:

- **Chart only real data.** Every value must come from a file or an observation cited in the report. Estimates, forecasts and "illustrative" numbers are never charted.
- **Give each chart its scope.** It needs a `source` and, for time data, the period and timezone in the `subtitle`.
- **Keep to one measure per chart.** There is no dual axis. If two measures belong together, use two charts.
- **Respect the series limit.** Charts are limited to 4 series. Fold the rest into "Other" or split the chart. The builder refuses more than 4.
- **Check the chart matches the text.** A chart and the text beside it must show the same numbers. Build the chart from the same CSV the text was calculated from.

## Check before sending

1. Run the builder. Fix any `WARNING` lines and any exit code 2.
2. Look at the output. Render a few PDF pages to images (`pdftoppm -r 80 -png -f 1 -l 3 report.pdf page`) and view them. Confirm the charts drew, the tables fit, Arabic text is shaped and right-to-left, and nothing is cut off.
3. Deliver all three versions:
   - the report document;
   - `report.html`;
   - `report.pdf`.

   In the report document, insert the PNGs from `charts/` where the format supports images.
