# 10 — HISTORY GRAPH (regenerate: `npm run graph`)

_Generated 2026-10-11T08:38Z from git. Cheap context for any new session:_
_read this + 01_CURRENT_STATE.md instead of re-deriving the project from scratch._

## Commit graph

```
* 580c9c6  (HEAD -> main) feat — separate pages (home/shop/PDP/lab w/ template deep-link) + USDA pumpkin FDC 170556 unblocks RM-016; psyllium documented as Branded-only dead-end; tests 65/65
* b5948dc  (origin/main) docs — regenerate history graph
* 6875496  feat — first UI look: Lab configurator + premade grid (Tailwind v4 on ADR-022/025 tokens), USDA fallback seeded (chia FDC 170554, buckwheat FDC 170687), AI hero + 5 pack images, biome config, db-setup script; tests 64/64
* 789f13e  chore: history-graph milestones via awk (grep -E asterisk escaping unreliable here)
* dc4954d  chore: refresh history graph (fix milestone grep: closing ** after date)
* 21bbb68  feat(slice): DB + API vertical slice — schema, migration, seed, mix endpoint
* 536b126  docs: README + competitive research (09); untrack .ssh
* 53b3c6a  chore: drop duplicate uploads/ (pixel-identical copies live in public/brand); ignore .npm/.cache/.local
* 361a93d  add: deploy key issued; forest accent (ADR-025); provisional seed rates (ADR-026)
* f659676  docs: stack comparison with verified 2026 free-tier facts; ADR-022 brand approval
* 416c3f7  feat(mix): verified calculation engine + brand design system
* 3392738  docs(project-os): initialise persistent project memory for ArogyaBhog
```

## Milestones (feat / decide / add commits)

- **2026-10-10** 416c3f7 — feat(mix): verified calculation engine + brand design system
- **2026-10-10** 361a93d — add: deploy key issued; forest accent (ADR-025); provisional seed rates (ADR-026)
- **2026-10-10** 21bbb68 — feat(slice): DB + API vertical slice — schema, migration, seed, mix endpoint
- **2026-10-10** 6875496 — feat — first UI look: Lab configurator + premade grid (Tailwind v4 on ADR-022/025 tokens), USDA fallback seeded (chia FDC 170554, buckwheat FDC 170687), AI hero + 5 pack images, biome config, db-setup script; tests 64/64
- **2026-10-11** 580c9c6 — feat — separate pages (home/shop/PDP/lab w/ template deep-link) + USDA pumpkin FDC 170556 unblocks RM-016; psyllium documented as Branded-only dead-end; tests 65/65


## Tracked tree

```
.gitignore
  00_SYSTEM_RULES.md
  01_CURRENT_STATE.md
  02_ARCHITECTURE.md
  03_DECISION_LOG.md
  04_DATABASE_SCHEMA.md
  05_ENV_TRACKER.md
  06_API_CONTRACTS.md
  07_DESIGN_SYSTEM.md
  08_STACK_COMPARISON.md
  09_COMPETITIVE_RESEARCH.md
  10_HISTORY_GRAPH.md
README.md
biome.json
brand-board.html
  FINDINGS.md
  SEED_RATES.md
  arogyabhog-main-sheet.xlsx
  ifct2017-mapped-nutrients.json
  seed-ingredient-rates.json
  seed-premade-recipes.json
  usda-fallback-nutrients.json
drizzle.config.ts
  0000_black_puma.sql
    0000_snapshot.json
    _journal.json
next-env.d.ts
package-lock.json
package.json
postcss.config.mjs
    logo-mark.png
    logo-wordmark.png
    hero-grains.png
    pack-everyday.png
    pack-high-protein.png
    pack-sugar-care.png
    pack-thyro-care.png
    pack-vitality.png
  db-setup.ts
  history-graph.sh
            route.ts
    globals.css
      page.tsx
    layout.tsx
    page.tsx
        page.tsx
      page.tsx
    LabClient.tsx
    client.ts
    schema.ts
    seed.ts
    mix-engine.test.ts
    mix-engine.ts
    contracts.ts
    mix-service.test.ts
    mix-service.ts
    storefront-data.ts
tsconfig.json
vitest.config.ts
```

## Head

580c9c6d1a0b838ab5fad95f7f41acb65d43948a
2026-10-11 08:38:52 +0000
feat — separate pages (home/shop/PDP/lab w/ template deep-link) + USDA pumpkin FDC 170556 unblocks RM-016; psyllium documented as Branded-only dead-end; tests 65/65
