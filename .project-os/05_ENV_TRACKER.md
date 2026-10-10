# 05 — ENVIRONMENT VARIABLE TRACKER

**NAMES AND SCOPES ONLY. NEVER COMMIT A VALUE.**
Actual secrets live in `.env.local` (git-ignored) and in the host's secret store.
`.env.example` ships with empty placeholders only.

---

## Required

| Variable | Scope | Purpose | Notes |
|---|---|---|---|
| `DATABASE_URL` | server | Primary DB connection | **Production:** Neon **pooled** (`-pooler`) endpoint. Serverless holds a connection per invocation; a direct URL exhausts ~10 concurrent lambdas. **Dev/test:** `file:local/arogyabhog.db` (libSQL) |
| `AUTH_SECRET` | server | Session signing / token encryption | ≥32 bytes random. Rotate = all sessions invalidated |
| `RESEND_API_KEY` | server | Transactional email (order + admin notifications) | ADR-016. Free tier ~3,000/mo, 100/day |
| `EMAIL_FROM` | server | Verified sender address | Requires domain verification in Resend |

## Store-scoped configuration (in DB, NOT env)

These vary **per store** and are admin-editable at runtime. They must never be
environment variables, or adding a city requires a redeploy.

| Field | Table | Default |
|---|---|---|
| `upi_vpa` | `stores` | — (client's UPI ID for that city's account) |
| `upi_payee_name` | `stores` | `ArogyaBhog` |
| `upi_mcc` | `stores` | `5411` (grocery) |
| `delivery_fee_paise` | `stores` | `5000` (₹50) |
| `packaging_fee_paise` | `stores` | `500` (₹5) |
| `milling_fee_paise_per_kg` | `stores` | `400` (₹4) |
| `gst_rate_bps` | `stores` | `500` (5%) |
| `min_base_grain_bps` | `stores` | `6000` (60%) |

## Optional / later

| Variable | Purpose | When |
|---|---|---|
| `SENTRY_DSN` | Error tracking | Phase 4 hardening — structured-logging seam built from day 1 so this drops in without refactor |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL for SEO/sitemap/JSON-LD | Phase 3 |
| `WHATSAPP_BUSINESS_TOKEN` | Order notifications via WhatsApp | Deferred — costs money per conversation; email first (ADR-016) |
| `IMAGE_UPLOAD_ENDPOINT` / `IMAGE_HOST` | Product & blog imagery | Phase 3 — decide host then |
| `CRON_SECRET` | Scheduled jobs (stale-cart cleanup, low-stock alerts) | Phase 4 |

## Rules

1. No secret may appear in `03_DECISION_LOG.md`, `04_DATABASE_SCHEMA.md`, a commit
   message, a test fixture, or a log line.
2. Structured logs must **redact** `AUTH_SECRET`, `RESEND_API_KEY`, `DATABASE_URL`
   credentials, customer phone numbers, and UPI VPAs.
3. `05_ENV_TRACKER.md` is updated in the **same commit** that introduces a new var.
4. Temporary credentials created for testing are removed before handoff (Phase 5).
