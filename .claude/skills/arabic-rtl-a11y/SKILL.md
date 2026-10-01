---
name: arabic-rtl-a11y
description: Applies the repository Arabic RTL, mixed-direction, localization and WCAG 2.2 AA rules. Use when building or reviewing a user-facing screen, report view, chart, generated copy, email or export in Arabic or English.
---

# Arabic, RTL and accessibility (policy skill)

Status: draft for review. Version 0.1.0. Owners: frontend lead `<DECIDE_AT_M0: name>` and localization reviewer `<DECIDE_AT_M0: name>`. Both sign off changes to this skill.

## When to use

- Any UI route, component, report view, chart or table.
- Any generated or templated copy shown to users (reports, briefs, drafts, emails, notifications).
- Registered-user PDF or document exports (anonymous users get none, D-002).
- Arabic slugs, hreflang, structured-data text and number formatting in product advice.

## Direction and markup

From 04-CLAUDE-CODE-BUILD-PROMPT §20, v1-baseline §14 and 02-DETAILED-SPECIFICATION §17:

- Set `lang` and `dir` from the locale on the document and on any element whose language differs (`<html lang="ar" dir="rtl">`).
- Use logical CSS properties (`margin-inline-start`, `padding-inline-end`, `inset-inline-start`); no hard-coded left/right for layout.
- The user can switch layout direction.
- Keep URLs, code, model names, formulas, provider names and technical terms LTR inside Arabic text: isolate them with `<bdi>` or `dir="auto"` / `dir="ltr"` spans.
- Do not mirror everything blindly: logos, code, phone numbers and media controls usually stay LTR (skill `references/arabic-market-seo.md`).
- Numbers in structured data use digits 0-9 and `.` as the decimal separator. Visible copy uses one numeral style per site (skill `references/arabic-market-seo.md`).

## Localization

- Arabic is authored and reviewed, not mechanically mirrored or translated from English (04 §2; 02 §9 "Writing rules").
- Modern Standard Arabic by default unless the workspace style guide sets a dialect; dialect terms are flagged for native review (02 §9; `templates/style-guide-ar.md`).
- Correct spelling (ة, ى, hamza) even when users search without it; spelling variants belong in keyword research, not in copy (02 §9).
- Localize every language version fully: titles, meta descriptions, alt text, Open Graph and structured-data text (skill `references/arabic-market-seo.md`).
- Public-facing generated content in Arabic needs native review; runtime outputs set `needs_native_review` when unsure (04 §20).
- Money: KWD, JOD and BHD with 3 decimals; SAR, AED and QAR with 2 (CONTEXT vocabulary; skill `references/arabic-market-seo.md`).
- Arabic and English flows have equal functional quality (01-PRODUCT-REQUIREMENTS §3) and pass functional parity (01 §15).

## Accessibility: WCAG 2.2 AA

Target WCAG 2.2 AA in both languages (01 §9; 04 §20). Check:

- Semantic headings, landmarks, forms and tables; accessible names for every control.
- Complete keyboard flow and visible focus.
- Contrast; never rely on color alone for pass/fail or severity.
- Reflow at narrow widths and 200% zoom; reduced-motion preference respected.
- Progress updates announced accessibly without excessive announcements (v1-baseline §14).
- Charts have text alternatives and data tables; error states are announced.
- PDF (registered exports only): reading order and selectable text preserved; Arabic-capable font embedded with correct glyph shaping, for example IBM Plex Sans Arabic under the SIL Open Font License (02 §17; v1-baseline §14).

Automated checks do not establish conformance. Manual keyboard, screen-reader, reflow and contrast review is required before launch (v1-baseline §14; 02 §17).

## Charts and numbers in UI

Real data only, with source and period; one measure per chart; at most 4 series; no dual axis (02 §15 "Controls"). Rates show numerator and denominator. Unavailable values read "Not available (needs export)" and name the export (02 §7).

## Evidence for a UI change

1. Screenshots of the changed screens in Arabic and English, compared with the approved mock.
2. Keyboard walk-through notes (focus order, traps, visible focus).
3. Automated accessibility check output, labelled as partial evidence.
4. Native-review flag for new Arabic copy, with reviewer name when done.
5. Areas of concern in `spec.md` for the frontend lead and localization reviewer.

## Checklist for a change

- `lang`/`dir` set from locale? Logical CSS only?
- LTR islands isolated (URLs, code, IDs, numbers with units where needed)?
- Arabic written, not translated? Dialect flagged?
- Keyboard, focus, contrast, reflow, reduced motion checked in both languages?
- Anonymous views expose no download or export control (D-002)?

## Backed by

- Test strategy: `docs/test-strategy.md` (browser tests for core EN/AR journeys; accessibility automation plus manual checks, 05-PROJECT-PLAN §7).
- Method references: `.claude/skills/marketing-seo-agent/references/arabic-market-seo.md`, `report-export.md`.
