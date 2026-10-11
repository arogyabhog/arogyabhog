# 01 — CURRENT STATE

**Phase:** 3 — VERTICAL SLICE (calculation engine built & verified; UI not started)
**Last updated:** 2026-10-10
**Git SHA:** see `git log`
**Active branch:** `main`

---

## STATUS

| Area | State |
|---|---|
| Discovery (Phase 1) | ✅ COMPLETE — client brief captured, source spreadsheet parsed & verified |
| Requirement clarification | ✅ COMPLETE — C1–C7 resolved by client |
| Nutrition data sourcing | ✅ RESEARCHED — IFCT 2017 obtained, coverage measured, gaps identified |
| Payment approach | ✅ DECIDED — COD + unsigned UPI intent QR, admin-verified (ADR-006) |
| Pricing model | ✅ DECIDED — admin sets 18 rates by hand + mandatory Price Consistency Checker (ADR-008) |
| Referral system | ✅ DECIDED — credits on first DELIVERED order, cap 10, referee bonus (ADR-017) |
| Pack sizes | ✅ DECIDED — standard 10/15/20 kg; mix 5/10/15/20 kg (ADR-021) |
| Database schema | 🟡 DRAFTED in `04_DATABASE_SCHEMA.md` — awaiting review |
| API contracts | 🟡 DRAFTED in `06_API_CONTRACTS.md` — awaiting review |
| **Calculation engine** | ✅ **BUILT & VERIFIED** — `src/domain/mix-engine.ts`, **54 tests green** incl. fast-check property suites and the client's real defects as regression tests |
| Toolchain | ✅ INSTALLED — exact-pinned TS 5.6.3, Vitest 2.1.9, fast-check 3.23.2, Zod 3.24.1 |
| Brand / logo / theme | ✅ **APPROVED** — heritage-premium direction (ADR-022); tokens binding for UI work |
| Hosting stack | ✅ **DECIDED — Bundle A**: Netlify Starter + Neon Free + Resend (ADR-023); Drizzle confirmed as data layer (ADR-024). Documented exit path = Bundle C (own VPS) |
| UI layer | ❌ NOT STARTED — begins after stack decision |

---

## 🔴 BLOCKERS

### ~~BLOCKER-1~~ → RESOLVED as a design question; now a **client data dependency**
Client chose: admin sets all 18 ingredient selling rates **by hand**, with the
Price Consistency Checker flagging divergence (ADR-008). Schema, engine and API
are unaffected. **The Lab cannot go live with correct prices until those 18 rates
exist** — that is a data-entry task for the client, and the checker is now
mandatory rather than merely advisable.

### ~~BLOCKER-2~~ → ✅ RESOLVED (ADR-017)
Referral credits awarded on the referee's **first `DELIVERED` order** (not signup),
referrer **capped at 10** credits (admin-configurable), referee who joins via a
code starts with **2** credits, and a delivery credit **may** stack with a discount
coupon. All abuse controls specified.

### BLOCKER-3 — FSSAI position on product naming  🔴 STILL OPEN
"Sugar Care" / "Thyro-Care" imply disease management. Client has not confirmed
whether FSSAI licensing or naming advice has been obtained.
**Not build-blocking** (names are editable content per ADR-020), but
**launch-blocking**. Requires the client to raise it with the owner.

### ~~BLOCKER-4~~ → ✅ RESOLVED (ADR-021)
Confirmed: **standard products are 10/15/20 kg only; 5 kg is custom-mix only.**
Minimum standard order ≈ ₹950. Commercial risk noted and accepted by the client;
the 5 kg custom mix (~₹400–500) is the low-cost entry point instead. Revisit with
post-launch data, not now.

---

## 🟡 OPEN (non-blocking, proceeding on documented default)

| Item | Default assumed |
|---|---|
| Ingredient selling rates (18 values) | Do not exist yet — client must supply |
| Methi Seeds cost | Missing from source data — treated as a data gap, NOT as ₹0 |
| Nutrition for 4 ingredients | USDA FoodData Central fallback, provenance-tagged |
| Manager coupon limits | Assume discount capped, no admin approval needed — confirm |
| Minimum order value | None |
| Free delivery threshold | None (referral credits only) |
| Auth method | Email + password (SMS OTP costs money per message) |
| Delivery slot selection | None — admin/driver contacts customer |
| PIN-code serviceability validation | Not required (city-level store scoping only) |

---

## ARTEFACTS PRODUCED

| Path | What |
|---|---|
| `discovery/arogyabhog-main-sheet.xlsx` | Frozen copy of client's Google Sheet (9 tabs) |
| `discovery/ifct2017-mapped-nutrients.json` | 12 ingredients × 20 nutrients, unit-converted, provenance-tagged |
| `discovery/FINDINGS.md` | All verified data defects + pricing analysis, with evidence |

---

## NEXT ACTIONS (in order)

1. Resolve BLOCKER-2 (referral decisions) — small, quick
2. Resolve BLOCKER-1 (ingredient selling rates) — needs client input
3. Review `04_DATABASE_SCHEMA.md` and `06_API_CONTRACTS.md`
4. **Then** and only then: `git` scaffold, toolchain install, vertical slice
   `DB → mix calculation engine → API → UI` with property-based tests first
5. Obtain logo → brand system → theme

## DELIBERATELY NOT DONE

No `package.json`, no dependencies installed, no framework scaffold, no migrations,
no product code. Held until schema review, because C1–C4 each had schema impact and
writing code against an unreviewed schema means rewriting it.

---

## Addendum 2026-10-11 (post-approval changes)

1. **Deploy key issued.** ed25519 keypair at `local/deploy_key` (private,
   gitignored, chmod 600); public half handed to the client for a repo deploy
   key with write access. GitHub reachable from the sandbox on :22 and :443.
2. **BLOCKER-1 (selling rates) downgraded again** → provisional seeds exist
   (`discovery/SEED_RATES.md`, ADR-026); remaining work is the client's guided
   review of the flagged rows, not a hard dependency.
3. **BLOCKER-3 (FSSAI naming): client will rename later.** Names stay as-is for
   now by client decision; ADR-020 already guarantees names are DB-editable
   content, so the rename is a content edit, not a code change. Launch risk
   accepted by the client; still advise an FSSAI/CA opinion before paid traffic.
4. **Forest accent approved** (ADR-025) — one darker colour, careful-use rules.
5. **Stack locked:** Bundle A (ADR-023) + Drizzle (ADR-024); runtime pinned.
6. **Vertical slice landed (2026-10-11):** Drizzle schema (10 tables) + migration
   `migrations/0000_black_puma.sql` + seeder from the frozen discovery artefacts
   + `POST /api/storefront/mix/calculate` (Zod → service → engine) + 9
   integration tests over migrated in-process libSQL. **63/63 tests green.**
   Notes: only RM-001 is base grain (sheet's own 'Base Grain' label); service
   golden prices at ADR-026 seed sell rates (raw 88550), the sheet-cost golden
   (46650) lives in the domain suite; CGST is floored, odd paisa to SGST.
   History graph tool: `npm run graph` → `.project-os/10_HISTORY_GRAPH.md`.

7. **2026-10-11 — Phase 5 first UI look.** Tailwind v4 on ADR-022/025 tokens (src/app/globals.css); storefront home (src/app/page.tsx) = hero + premade grid with exact-% disclosure + Lab configurator (src/components/LabClient.tsx) wired to POST /api/storefront/mix/calculate with debounced live certificate, snap-to-pack, base-grain meter, friendly error hints, provisional + estimated chips. USDA fallback seeded (chia FDC 170554, buckwheat FDC 170687 w/ kJ→kcal patch); psyllium + pumpkin stay "nutrition pending" (429 quota, mirrors conflict — ADR-007). AI imagery: public/img/hero-grains.png + 5 pack shots. scripts/db-setup.ts builds local/dev.db. Next auto-patched tsconfig (jsx react-jsx, allowJs, .next types); we added DOM libs + src/**/*.tsx to include. Tests 64/64 (new: chia USDA provenance).

8. **2026-10-12 — USDA round 2 + separate pages.** Pumpkin resolved: FDC **170556** (SR Legacy, 12/12; Energy 2339 kJ → 559.0 kcal — confirms the FDC-citing mirror, earlier "conflict" was bad mirrors). The previously noted id 170148 was **hemp seeds** — caught by re-fetching the detail before trusting it. Psyllium is a documented dead-end: USDA has Branded-only entries, best 7/12 nutrients with corrupt iron labelling → stays unmixable per ADR-007 until lab analysis. Storefront restructured to separate pages per client note: `/` (hero + promise strip + featured + one forest CTA band per ADR-025), `/shop`, `/shop/[slug]` (PDP with FULL exact-% composition table, composition-led copy, zero disease claims per FSSAI Reg 10(1)/L8), `/lab` (supports `?template=slug`; "Start from a blend" chips implement L2). Shared queries in `src/server/storefront-data.ts`. Tests 65/65 (pumpkin USDA band test added).

9. **2026-10-12 — Orders + payments slice (ADR-027).** Domain `order-engine.ts`: two closed state machines (fulfilment 9-state, payment 3-state) as data tables, `OrderError` union, GST re-derivation from inclusive prices (reuses engine `roundHalfUp`), delivery-credit redemption/refund rules, frozen-snapshot consistency checker (26 tests incl. full 9×9 + 3×3 matrices and a fast-check round-trip). Schema: `orders` (money columns + snapshot JSON + CHECKs on kind/method) + `order_events` timeline; migration `0001_talented_master_chief.sql`. Service `order-service.ts`: createLabOrder (prices via mix engine, goldens 98050/93050-waived), createPremadeOrder (shelf price all-inclusive, single honest money line + composition %, gst 4524/2262/2262), transitions write BOTH order_events and audit_log, cancel refunds credits, CLOSED gated behind PAID (RTO exempt). No API routes yet — deliberate, auth slice first (ADR-014). Tests 103/103 stable ×2.

10. **2026-10-12 — PDP nutrition tables + forest promotion (ADR-028) + responsive pass.** New pure domain `nutrition-blend.ts` (8 tests): bps-weighted per-100 g + per-pack nutrition with per-row coverage in bps and auto-scaling unit formatter (µg→mg→g→kg; caught-and-fixed a trailing-zero regex bug that turned 390 into 39). PDPs now show a second table — 18 nutrients grouped (macronutrients/minerals/vitamins), per 100 g AND per 10 kg pack, `estimated` chip, sources, and an honest coverage note when an ingredient lacks data (live: High-Protein 98.0% + Vitality 99.0%, psyllium pending). Benefit lines added per blend — composition + general nutrient roles only, zero disease claims. **Copy correction forced by data:** first-draft blend descriptions contradicted the actual seeded recipes (Thyro-Care is wheat-free/40% kuttu; psyllium lives in High-Protein 2% + Vitality 1%, NOT Sugar Care) — all COPY/BENEFITS rewritten recipe-truthful from seed-premade-recipes.json. Forest green promoted per client directive (ADR-028): promise strip + footer forest-950 bands, forest-900 table headers w/ gold text, forest interactive states (pills, chips, focus rings, sliders, primary CTAs), gold kept for money. Responsive pass: fluid hero (mobile-first gradient), wrapping CTAs, md/lg grid steps, compact Lab rows (grams column hidden <sm, tighter inputs), overflow-x tables, smaller paddings. Tests 111/111.

11. **2026-10-12 — Visual QA harness + the four client-reported UI bugs, root-caused.** Added `scripts/screenshot.mjs` (playwright-core headless Chromium): screenshots 4 routes × 2 viewports AND measures `scrollWidth` vs `clientWidth` with per-element overflower lists — visual regressions are now measured, not guessed. Findings & fixes: (a) **"menu bar bigger than the page"** = Lab composer rows used `truncate` (nowrap) inside flex items; flex min-content summed full name widths (up to 477px) → grid track blew out → whole page scrolled sideways on phones. Rows rebuilt as CSS grid `minmax(0,1fr)` tracks; verified scrollWidth == viewport on all routes at 390px and 1280px; `body{overflow-x:clip}` as safety net. (b) **"blue colors"** = not our palette (hero/pack art verified warm by inspecting the PNGs) — it was browser UA chrome: Android tap-highlight flash, default focus rings, native control accents. Globals now: tap-highlight transparent, forest focus-visible rings, forest accent-color, gold caret. (c) **"green not on products"**: product-card hover green removed (→ gold); forest stays page-structure only (bands, table headers, controls, footer) per ADR-028. (d) **invisible text**: mobile hero copy sat on the photo through a weak gradient → solid ivory wash below `sm`; 21× ink-400 helper text → ink-500; footer/promise body lightened. Note: the round "N" badge in screenshots is Next's dev-mode indicator, absent in production.
