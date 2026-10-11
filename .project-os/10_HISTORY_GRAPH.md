# 10 — HISTORY GRAPH (regenerate: `npm run graph`)

_Generated 2026-10-11T14:44Z from git. Cheap context for any new session:_
_read this + 01_CURRENT_STATE.md instead of re-deriving the project from scratch._

## Commit graph

```
* 652aa7d  (HEAD -> main) feat — auth + RBAC slice (ADR-031): scrypt sessions, /login, gated /admin console + audit log with CSV export; pack rule: 5 kg Lab-only (ADR-029 amendment); tests 119/119 + 7/7 browser flow
* f552137  (origin/main) docs — production serving note + graph
* abfc8d2  ops — production build + no-store headers; preview stale-cache lockdown
* 50f45da  chore — biome ignores Next-generated next-env.d.ts
* 8084d2b  style — biome.json layout
* 5caa189  docs — structure pass notes + graph
* 7b52649  design — structure pass per client screenshots + ui-ux-pro-max-skill rules: 3-zone nav w/ active state, framed hero, numbered value band, uniform cards, compact Lab, roomier PDP tables, 4-col footer, regenerated pack imagery
* ae384f7  style — biome.json formatter layout
* 533cd27  chore — exclude playwright browser cache from biome; drop stray sudo marker file
* 25ba0a3  docs — visual QA harness + UI bug post-mortem, graph
* 9755750  fix — root-cause the four reported UI bugs: Lab min-content overflow (grid tracks), UA blue chrome (global focus/tap/accent), green off product cards, mobile hero legibility + contrast sweep; add playwright screenshot/overflow harness
* 5c94bee  docs — ADR-028 + current state + graph
* ed21602  feat — PDP nutrition tables (18 nutrients × per-100g/per-pack, coverage-honest), benefit lines, forest-green promotion per client (ADR-028), responsive pass; recipe-truthful copy; tests 111/111
* d926c37  docs — ADR-027, current state, history graph
* a5b7bdc  feat — orders+payments slice (ADR-027): two state machines, frozen money snapshots, delivery credits, dual audit; USDA pumpkin unblocked earlier this session; tests 103/103
* 457bad5  docs — history graph + current state
* 580c9c6  feat — separate pages (home/shop/PDP/lab w/ template deep-link) + USDA pumpkin FDC 170556 unblocks RM-016; psyllium documented as Branded-only dead-end; tests 65/65
* b5948dc  docs — regenerate history graph
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
- **2026-10-11** a5b7bdc — feat — orders+payments slice (ADR-027): two state machines, frozen money snapshots, delivery credits, dual audit; USDA pumpkin unblocked earlier this session; tests 103/103
- **2026-10-11** ed21602 — feat — PDP nutrition tables (18 nutrients × per-100g/per-pack, coverage-honest), benefit lines, forest-green promotion per client (ADR-028), responsive pass; recipe-truthful copy; tests 111/111
- **2026-10-11** 652aa7d — feat — auth + RBAC slice (ADR-031): scrypt sessions, /login, gated /admin console + audit log with CSV export; pack rule: 5 kg Lab-only (ADR-029 amendment); tests 119/119 + 7/7 browser flow


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
  frida-national-table-nutrients.json
  ifct2017-mapped-nutrients.json
  seed-ingredient-rates.json
  seed-premade-recipes.json
  usda-fallback-nutrients.json
drizzle.config.ts
  0000_black_puma.sql
  0001_talented_master_chief.sql
  0002_abnormal_morbius.sql
  0003_warm_luke_cage.sql
    0000_snapshot.json
    0001_snapshot.json
    0002_snapshot.json
    0003_snapshot.json
    _journal.json
next-env.d.ts
next.config.ts
package-lock.json
package.json
postcss.config.mjs
    logo-mark.png
    logo-wordmark.png
    hero-grains.png
    pack-bajra.png
    pack-everyday.png
    pack-high-protein.png
    pack-jau.png
    pack-jowar.png
    pack-moong.png
    pack-ragi.png
    pack-sugar-care.png
    pack-thyro-care.png
    pack-vitality.png
    pack-wheat.png
  admin-flow.mjs
  db-setup.ts
  history-graph.sh
  screenshot.mjs
          route.ts
        page.tsx
      layout.tsx
      logout-button.tsx
      page.tsx
            route.ts
    globals.css
      page.tsx
    layout.tsx
      actions.ts
      page.tsx
    page.tsx
        page.tsx
      page.tsx
    LabClient.tsx
    NavBar.tsx
    PackPicker.tsx
    ProductCard.tsx
    client.ts
    schema.ts
    seed.ts
    mix-engine.test.ts
    mix-engine.ts
    nutrition-blend.test.ts
    nutrition-blend.ts
    order-engine.test.ts
    order-engine.ts
    audit-export.ts
    auth.test.ts
    auth.ts
    contracts.ts
    mix-service.test.ts
    mix-service.ts
    order-service.test.ts
    order-service.ts
    passwords.ts
    storefront-data.ts
tsconfig.json
vitest.config.ts
```

## Head

652aa7d1e57cb264e24b3bc387a5d44154cf4c12
2026-10-11 14:44:37 +0000
feat — auth + RBAC slice (ADR-031): scrypt sessions, /login, gated /admin console + audit log with CSV export; pack rule: 5 kg Lab-only (ADR-029 amendment); tests 119/119 + 7/7 browser flow
