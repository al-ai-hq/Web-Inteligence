# Intent: M9 Production Readiness

| Field               | Value                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------- |
| ID                  | INT-03                                                                                |
| Status              | draft                                                                                 |
| Author (originator) | <DECIDE_AT_M9: product owner name>                                                    |
| Product owner       | <DECIDE_AT_M9: name>                                                                  |
| Security engineer   | <DECIDE_AT_M9: name>                                                                  |
| Milestone           | M9 (docs/m9-roadmap.md Priority 1: Production Readiness)                              |
| Ticket              | none                                                                                  |
| Created             | 2026-10-14                                                                            |
| Depends on          | M8 (Content & Schema Studio) complete; User accounts and score tracking complete      |
| Risk class          | high-risk: production deployment, database migration, email sending, abuse prevention |

## Problem

The platform is feature-complete (M0A–M8, user accounts) and deployed to Vercel at https://web-inteligence.vercel.app, but is not production-ready for pilot users. Four blockers prevent public launch:

1. **Vercel Deployment Protection** is enabled, requiring SSO to access the site. This blocks all public traffic. The deployment also uses a Vercel subdomain instead of a custom domain, which undermines brand trust and SEO.
2. **Database is local-only** (Docker Postgres `stratum_audit_db` on port 5432, database `wpi_dev`). No production database exists. All audit data, user accounts, and OAuth tokens are on the developer's machine. A production deployment with no persistent database means data loss on every deploy.
3. **No email notifications** exist. Users cannot receive audit completion emails, weekly digests, or password reset flows. This is a critical gap for user engagement and account recovery.
4. **Rate limiting is incomplete**. Auth routes (login/signup) have rate limiting (10 failures/15min per IP+email), but anonymous audit submission has no per-IP rate limits, and signed-in users have no per-user quotas. This leaves the platform vulnerable to abuse (cost overruns, spam audits).

Without M9, the platform cannot accept pilot users. The M10 roadmap (Recommendations Engine, Competitor Tracking) depends on M9 being complete first.

## Proposed outcome

From the M9 roadmap (docs/m9-roadmap.md Priority 1), complete and reviewed:

1. **Vercel Deployment Protection Fix**:
   - Disable SSO requirement in Vercel dashboard (allow public access).
   - Add custom domain (e.g., `wpi.ai` or similar — `<DECIDE_AT_M9: domain>`).
   - Set up production environment variables in Vercel (DATABASE_URL, ENCRYPTION_KEY, COOKIE_SECRET, GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, EMAIL_SERVICE_API_KEY).
   - Verify deployment builds and runs successfully with production config.

2. **Database Migration to Production**:
   - Create production database (Vercel Postgres or Supabase — `<DECIDE_AT_M9: provider>`).
   - Run all 17 migrations (0001 through 0017) on production database.
   - Set up automated backups (daily for Vercel Postgres, or Supabase PITR).
   - Verify all tables exist with correct schema (audits, users, sessions, oauth_tokens, etc.).
   - Test OAuth flow end-to-end in production (Google consent → callback → encrypted token storage).

3. **Email Notifications**:
   - Integrate email service (Resend, SendGrid, or similar — `<DECIDE_AT_M9: provider>`).
   - Implement audit completion email (sent when audit finishes, includes link to report).
   - Implement weekly digest email for signed-in users (summary of audit activity, score trends).
   - Implement password reset flow (email with reset link, token expiry, rate limiting).
   - Bilingual EN + AR for all email templates; native Arabic review required.
   - Email sending is async (queue or background job) to avoid blocking API responses.

4. **Rate Limiting & Abuse Prevention**:
   - Per-IP rate limits for anonymous audits (e.g., 5 audits/hour per IP — `<DECIDE_AT_M9: limit>`).
   - Per-user quotas for signed-in users (e.g., 50 audits/month per user — `<DECIDE_AT_M9: quota>`).
   - CAPTCHA for suspicious activity (e.g., after 3 failed audit submissions in 10 minutes from same IP — `<DECIDE_AT_M9: threshold>`).
   - Rate limiter storage: in-memory for MVP (acceptable for pilot scale), or Redis for production scale.
   - Rate limit headers in API responses (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset).
   - Bilingual error messages for rate-limited responses.

## Affected users and systems

**Users:** pilot users (public access, email notifications), product owner (production database management, domain setup), security engineer (rate limiting, abuse prevention, CAPTCHA).

**Systems:**

- `apps/web` — new API routes for email sending, rate limiting middleware, CAPTCHA integration
- `packages/email` (new) — email service abstraction (Resend/SendGrid adapter), template rendering
- `packages/rate-limiter` (new) — rate limiting logic (in-memory or Redis-backed), quota tracking
- `infra/terraform/prod` (new or update) — production database provisioning, environment variables
- Vercel dashboard — deployment protection settings, custom domain, environment variables

## Constraints

- **D-002** anonymous reports: in-app only, no downloads, private link plus signed secret, `noindex`, deletable, 7-day expiry. Email notifications must not violate this (emails contain links to in-app reports, not attachments).
- **D-005** one combined USD 150 monthly cap (hosting plus paid calls). Email service and CAPTCHA service costs must fit within this cap. Production database cost (Vercel Postgres or Supabase) must also fit.
- **D-014** every record belongs to a project. Rate limiting and quota tracking must be project-scoped for signed-in users.
- **CLAUDE.md conventions:** Arabic UI uses logical CSS, `dir` from locale, bidi-isolate URLs and code; Arabic copy needs native review. Email templates and error messages must be bilingual.
- **Security:** production database credentials, email service API keys, and CAPTCHA secrets must be stored securely (Vercel environment variables, not in code). OAuth tokens are already encrypted at rest (AES-256-GCM via `packages/oauth/`).
- **Policy skills that apply:** `security-baseline` (production secrets, rate limiting, CAPTCHA), `data-integrity` (email delivery tracking, rate limit audit log), `cost-guard` (email + CAPTCHA + database costs within USD 150 cap).

## Out of scope

- M10 features (Recommendations Engine, Competitor Tracking) — deferred to INT-02.
- M11 features (AI Content Assistant) — deferred.
- Multi-region deployment — deferred to M12.
- Enterprise features (SSO, audit log, SLA) — deferred to M12.
- Advanced analytics (industry benchmarking, trend analysis) — deferred to M12.

## Exit gate

From the M9 roadmap, independent reviews can:

1. Access the production site without SSO (public access verified).
2. Load the site on a custom domain (not `*.vercel.app`).
3. Submit an audit in production and verify the audit record persists in the production database (not local).
4. Receive an audit completion email after the audit finishes (email delivery verified).
5. Trigger a rate limit on anonymous audit submission (e.g., 6th audit in 1 hour from same IP is rejected with 429).
6. Verify per-user quota enforcement for signed-in users (e.g., 51st audit in a month is rejected).
7. Trigger CAPTCHA after suspicious activity (e.g., 3 failed submissions in 10 minutes).
8. Verify bilingual EN + AR for all new email templates and error messages.

Each proof is recorded in this intent's `release.md` with the command, fixture and reviewer.

## Open questions

- **<DECIDE_AT_M9>** Custom domain for production (proposal: `wpi.ai` or `web-intelligence.ai`). Owner: product owner.
- **<DECIDE_AT_M9>** Production database provider: Vercel Postgres or Supabase? (Vercel Postgres is simpler, Supabase has more features like PITR.) Owner: product owner with security engineer.
- **<DECIDE_AT_M9>** Email service provider: Resend, SendGrid, or other? (Resend is developer-friendly, SendGrid is enterprise-grade.) Owner: product owner.
- **<DECIDE_AT_M9>** Per-IP rate limit for anonymous audits (proposal: 5 audits/hour per IP). Owner: product owner with security engineer.
- **<DECIDE_AT_M9>** Per-user quota for signed-in users (proposal: 50 audits/month per user). Owner: product owner.
- **<DECIDE_AT_M9>** CAPTCHA threshold (proposal: 3 failed audit submissions in 10 minutes from same IP triggers CAPTCHA). Owner: product owner with security engineer.
- **<DECIDE_AT_M9>** CAPTCHA provider: hCaptcha, reCAPTCHA, or Cloudflare Turnstile? (hCaptcha is privacy-friendly, reCAPTCHA is widely used, Turnstile is free for low traffic.) Owner: product owner with security engineer.
- **<DECIDE_AT_M9>** Rate limiter storage: in-memory (simple, acceptable for pilot) or Redis (production scale, shared across instances)? Owner: security engineer.
- **<DECIDE_AT_M9>** Email template design: plain text or HTML with branding? Owner: product owner.
- **<DECIDE_AT_M9>** Weekly digest content: what metrics to include? (audit count, score trends, top findings?) Owner: product owner with SEO lead.

## Links

- Roadmap: `docs/m9-roadmap.md` (Priority 1: Production Readiness)
- Spec: `intent/INT-03-m9-production-readiness/spec.md` (after acceptance)
- Plan: `intent/INT-03-m9-production-readiness/plan.md` (after spec approval)
- Release: `intent/INT-03-m9-production-readiness/release.md` (after merge)
- M10 intent (deferred): `intent/INT-02-m10-recommendations-competitor/intent.md`
