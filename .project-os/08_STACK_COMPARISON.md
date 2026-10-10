# 08 — STACK COMPARISON (prepared for client decision, 2026-10-10)

Prepared because the client asked to see alternatives side-by-side before locking
the stack. All pricing/limit facts below were **verified against 2026 sources**
(listed at the bottom), not recalled from memory. Costs in ₹ where noted
(≈ ₹84/$ at time of writing).

Project constraints that shape every choice:
- Commercial product (a real store) → free tiers that ban commercial use are disqualified.
- Pre-launch, low traffic → scale-to-zero / free tiers are ideal; always-on paid compute is waste.
- Learning/exploration tier → narrate trade-offs; prefer stacks with transferable knowledge.
- No Docker in the build sandbox → the DB layer must run in-process for tests (libSQL).
- Responsive web now, native mobile later against the same API → API must be first-class.
- SEO/GEO is a stated goal → SSR/SSG for storefront, blog, nutrition tables.

---

## Decision 1 — Application framework

| | **Next.js (App Router)** ✅ rec | Vite SPA + Hono API | Remix / React Router 7 | Astro + islands |
|---|---|---|---|---|
| SEO/GEO (SSR/SSG/ISR) | ✅ built-in, mature | ⚠️ needs prerender add-on or separate marketing site | ✅ built-in | ✅ best-in-class for content |
| App-like surfaces (Lab, cart, admin) | ✅ | ✅ | ✅ | ⚠️ islands get awkward for authed app pages |
| API for future mobile app | ✅ route handlers = the contract | ✅ API-first by construction | ✅ resource routes | ⚠️ endpoints exist but app-backends are second-class |
| Deploys to operate | 1 | 2 (web + api) | 1 | 1 + api usually |
| Learning curve | steepest | gentlest | medium | medium |
| Ecosystem / examples / hiring | largest | large | medium | medium |
| Fit verdict | **best all-rounder for a commerce site that is half content, half app** | best if simplicity beats SEO | good, smaller community | best if blog-led, not app-led |

**Recommendation: Next.js.** ArogyaBhog is simultaneously a content site (SEO/GEO,
blog, crawlable nutrition tables) and a web app (Lab, cart, checkout, admin).
Next is the only option where both halves are first-class in one deploy, and its
route handlers become exactly the API the deferred mobile app will consume.

---

## Decision 2 — Verified 2026 free-tier facts (the part that changes answers)

| Platform | Free tier reality (2026) | Consequence for us |
|---|---|---|
| **Vercel Hobby** | **Commercial use NOT allowed** — ToS requires Pro ($20/mo) for any commercial project. Hobby also caps 100 GB egress, 100 K invocations, 10 s function timeout | ❌ disqualified for a real store unless we pay $20 |
| **Supabase Free** | Project **pauses after 7 days of inactivity**; 500 MB DB; no PITR; 2 active projects | ❌ a pre-launch store is quiet by definition — the site would sleep until manually unpaused |
| **Cloudflare Pages/Workers Free** | Static unlimited, but Pages Functions = Workers free: **100 K req/day and 10 ms CPU per request**, 50 subrequests | ❌ 10 ms CPU cannot hold an SSR render + DB round-trip |
| **Netlify Starter** | Free, **small commercial projects explicitly fine**: 100 GB bandwidth, 300 build min/mo, 125 K function invocations/mo | ✅ viable at launch volumes |
| **Neon Free** | **Permanent** free: 100 CU-hrs/mo per project, 0.5 GB storage, scale-to-zero always on, 6 h PITR, unlimited branches. Free regions per current listings: us-east-1, eu-central-1, ap-southeast-1 (**no Mumbai**) | ✅ viable; ~0.5 s cold start after idle; Singapore is the nearest region |
| **VPS (DO Bengaluru / Hetzner)** | Not free: ~₹400–600/mo for 1–2 GB RAM box | ✅ viable; you own everything incl. backups and TLS |

---

## Decision 3 — Hosting bundles (framework + host + DB as coherent packages)

| | **Bundle A — "Serverless free"** ✅ rec | **Bundle B — "Vercel clean"** | **Bundle C — "Own everything"** | **Bundle D — "Simplest mental model"** |
|---|---|---|---|---|
| App host | Netlify Starter (free) | Vercel **Pro** $20/mo | VPS: Caddy + Node (Docker) | Netlify/VPS |
| Framework | Next.js | Next.js | Next.js (self-hosted, `output: standalone`) | Vite SPA + Hono API |
| Database | Neon Free (Singapore) | Neon Free | Postgres 16 in Docker on the VPS (Bengaluru → ~10–25 ms) | Neon Free or VPS Postgres |
| Est. monthly cost | **₹0** | ≈ ₹1,700 | ≈ ₹400–600 | ₹0 |
| Ops burden | near-zero | near-zero | **you run backups, TLS, updates, CI** | near-zero but 2 deploys + SEO prerender work |
| Cold starts | ~0.5 s DB after idle | same | none (always-on) | same as A |
| Legal for commerce | ✅ | ✅ | ✅ | ✅ |
| Lock-in | low (Next is portable; Neon is plain Postgres) | low-medium | **none** | lowest |
| Learning value | high (serverless + Postgres branching) | high | **highest** (real ops: Caddy, backups, tuning) | high (API design) but you lose SSR learning |
| Launch-risk | low | low | medium (self-inflicted outages possible) | medium (SEO gaps) |
| Exit path | move to C later with a connection-string + deploy change | same | n/a | n/a |

**Recommendation: Bundle A.** ₹0/month, legal for commerce, and every piece is
plain enough to leave later: Next is portable, Neon is just Postgres, auth and
payments are already provider-free by design. **Bundle C is the honourable
runner-up** — if the client's real goal this year is *learning ops*, the VPS
teaches more than any serverless platform, for ₹500/month and real responsibility.
This is a values choice, not a technical one: **cheap-and-portable (A) vs
own-and-learn (C).**

---

## Decision 4 — Data access layer

| | **Drizzle** ✅ rec | Prisma | Kysely | Raw SQL |
|---|---|---|---|---|
| Mental model | SQL-first, schema-as-code | query-builder-first, schema.prisma | pure query builder | none |
| Engine/binary | none (pure TS) | Rust query engine (memory + cold-start weight in a 1.9 GB sandbox and serverless) | none | none |
| Dialects | libSQL **and** Postgres (our dev→prod swap) | Postgres etc., but libSQL support is second-class | many | per-dialect by hand |
| Migrations | drizzle-kit, SQL you can read | prisma migrate, opaque drift | bring your own | bring your own |
| Fit for ~22 tables + integer-money discipline | ✅ types mirror columns exactly | ✅ | ⚠️ more boilerplate | ⚠️ too much hand-work |

**Recommendation: Drizzle** — already assumed by ADR-004/019; the comparison
confirms it. Prisma's engine binary is precisely what this sandbox and
serverless free tiers punish.

---

## Decision 5 — Auth

| | **Custom sessions** ✅ rec | Auth.js (NextAuth) | Clerk |
|---|---|---|---|
| RBAC (ADMIN / store-scoped MANAGER / CUSTOMER) | designed exactly for it (ADR-014) | possible via callbacks, fights the library | roles yes, store-scoping no |
| argon2id + httpOnly cookies + audit log | ✅ | ✅ | ✅ but identity lives with a vendor |
| Dependency risk | none | medium (version churn) | **lock-in + per-MAU pricing later** |
| Code cost | ~200 lines, testable | config | SDK |

**Recommendation: custom.** Three roles with store scoping plus a mandatory
audit log is bespoke by nature; a vendor auth layer would be fought, not used.

---

## Verified sources (2026)

- Neon free plan: vela.run Neon pricing 2026; selfhost.dev Neon pricing; dev.to Neon free-tier (regions, 0.5 GB, 100 CU-h).
- Supabase pause-after-7-days: itpathsolutions.com Supabase free tier 2026; uibakery.io Supabase pricing 2026.
- Vercel Hobby commercial ban + caps: deploywise.dev Vercel pricing 2026; decloak.dev Hobby limits.
- Cloudflare Workers/Pages free ceilings: temps.sh Cloudflare Pages free tier 2026; eastondev.com free-tier checklist.
- Netlify Starter free + small-commercial fit: dupple.com Netlify pricing 2026; luckymedia.dev Netlify review 2026.
