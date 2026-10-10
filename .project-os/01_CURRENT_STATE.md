# 01 — CURRENT STATE

**Phase:** 2 — ARCHITECTURE (schema drafted, awaiting review)
**Last updated:** 2026-10-10
**Git SHA:** see `git log` (repo initialised this phase)
**Active branch:** `main` (no feature work started yet)

---

## STATUS

| Area | State |
|---|---|
| Discovery (Phase 1) | ✅ COMPLETE — client brief captured, source spreadsheet parsed & verified |
| Requirement clarification | ✅ COMPLETE — C1–C7 resolved by client |
| Nutrition data sourcing | ✅ RESEARCHED — IFCT 2017 obtained, coverage measured, gaps identified |
| Payment approach | ✅ DECIDED — COD + unsigned UPI intent QR, admin-verified (ADR-006) |
| Pricing model | ⚠️ DECIDED but **has an unresolved consistency problem** (see BLOCKER-1) |
| Database schema | 🟡 DRAFTED in `04_DATABASE_SCHEMA.md` — awaiting review |
| API contracts | 🟡 DRAFTED in `06_API_CONTRACTS.md` — awaiting review |
| Referral system | ⚠️ REQUESTED — 4 decisions outstanding (see BLOCKER-2) |
| Toolchain / scaffold | ❌ NOT STARTED — deliberately held |
| Product code | ❌ NOT STARTED — deliberately held |
| Brand / logo / theme | ❌ BLOCKED on client supplying logo |

---

## 🔴 BLOCKERS

### BLOCKER-1 — Custom-mix vs standard-product price inconsistency
The client's chosen pricing rule (mix price = Σ ingredient × ingredient *selling*
rate) **cannot be made consistent with standard product MRPs using a single
uniform ingredient markup.** Verified numerically — see
`discovery/FINDINGS.md` §3 and ADR-008.

Requires a client decision on how ingredient selling rates are set.
**Not schema-blocking** (schema supports either answer), but it is
**launch-blocking**: it is a customer-visible price contradiction on a single page.

### BLOCKER-2 — Referral system: 4 open decisions
Award trigger, cap, stacking, and abuse controls. See `03_DECISION_LOG.md` ADR-017.
**Schema-blocking** for the `referrals` table semantics.

### BLOCKER-3 — FSSAI position on product naming
"Sugar Care" / "Thyro-Care" imply disease management. Client has not confirmed
whether FSSAI licensing or naming advice has been obtained.
**Not build-blocking** (names are editable content), but **launch-blocking**.

### BLOCKER-4 — Standard-product pack sizes, commercially
Client stated 5 kg is available **only** for custom mixes, so standard products
sell at 10 / 15 / 20 kg. Minimum standard order therefore ≈ ₹950.
The source spreadsheet priced standard products at 1 kg and 5 kg.
Confirm this is intentional — it raises the barrier to a first purchase
significantly for a pre-launch brand.

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
