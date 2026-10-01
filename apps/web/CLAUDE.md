# apps/web

Next.js 15 application (App Router). Strict TypeScript. Bilingual Arabic/English.

## Commands

- `pnpm --filter @wpi/web dev` — start dev server
- `pnpm --filter @wpi/web build` — production build
- `pnpm --filter @wpi/web lint` — ESLint via Next.js
- `pnpm --filter @wpi/web test` — Vitest

## Rules

- Every page must set `lang` and `dir` correctly for its locale.
- No client-side secrets. No API keys in components.
- React Server Components by default; `"use client"` only when needed.
- No `any`. No `@ts-ignore`. Fix the type or record an open item.
