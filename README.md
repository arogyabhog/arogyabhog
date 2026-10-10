# ArogyaBhog · डी2सी आटा commerce with a custom-blend Lab

D2C e-commerce for a pre-launch flour (atta) brand in Kanpur, UP.
Brand values: **authenticity, purity, transparency, health.** Own delivery
drivers. COD + providerless UPI QR. **No returns, by client decision.**

The product's centrepiece is the **Lab**: customers compose their own flour
from ~18 ingredients under real constraints (base-grain floor, per-ingredient
caps, exact pack weights) and see a line-by-line price breakdown and estimated
nutrition — transparency as the brand promise.

## Status

Pre-launch build. The **calculation engine is built and verified**
(`src/domain/mix-engine.ts`, 54 tests incl. property-based/fuzz suites and
golden regressions against the client's own spreadsheet). UI layer not started.
See `.project-os/01_CURRENT_STATE.md`.

## Stack (ADR-023/024)

TypeScript strict · Next.js 16 (Netlify) · Drizzle ORM → libSQL (dev/test) /
Neon Postgres (prod) · Zod at every boundary · Vitest + fast-check · Biome ·
Resend email · no payment gateway by design.

## Docs map (`.project-os/`)

| File | Contents |
|---|---|
| `00_SYSTEM_RULES.md` | engineering invariants R1–R10 (integer money, zero-trust, audit…) |
| `01_CURRENT_STATE.md` | phase, blockers, what's done |
| `02_ARCHITECTURE.md` | stack, trust boundaries, engine pipeline, order flow |
| `03_DECISION_LOG.md` | ADR-001…ADR-026 |
| `04_DATABASE_SCHEMA.md` | ~22 tables, tenancy, state machines, referral lifecycle |
| `05_ENV_TRACKER.md` | env var names only (secrets never stored here) |
| `06_API_CONTRACTS.md` | typed endpoints + error codes |
| `07_DESIGN_SYSTEM.md` | approved brand tokens, measured WCAG contrast |
| `08_STACK_COMPARISON.md` | hosting/ORM/auth comparison with verified 2026 facts |
| `09_COMPETITIVE_RESEARCH.md` | market + UX research and what we learn from it |

`brand-board.html` is the visual brand contract. `discovery/` holds the frozen
client sheet, the IFCT-2017 nutrient mapping, findings, and provisional seed
rates (`SEED_RATES.md`, `seed-ingredient-rates.json`).

## Quickstart

```bash
npm ci          # exact-pinned; node_modules is never committed
npm run verify  # tsc --noEmit && vitest run
npm test        # engine + property suites
```

## Hard invariants (see R1–R10)

- Money in **integer paise**, weight in **integer grams**, ratios in **integer
  basis points**. No floats in the money path, ever.
- Missing price/nutrient data **hard-fails and names the ingredient** — never
  computes as zero (the "Vitality Rule", from a real defect in the client sheet).
- Every tenant row carries `store_id`; RBAC enforced server-side only.
- No return/refund code paths exist, by client decision.

## Licence

UNLICENSED — private client project.
