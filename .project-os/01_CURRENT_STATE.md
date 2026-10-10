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
| Hosting stack | 🟡 **AWAITING CLIENT CHOICE** — Bundle A (free serverless) vs C (own-a-VPS) etc., see `08_STACK_COMPARISON.md` |
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
