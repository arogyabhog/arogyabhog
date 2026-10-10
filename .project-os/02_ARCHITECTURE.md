# 02 — ARCHITECTURE

## 1. STACK (ADR-005)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js** (App Router) + TypeScript strict | One deployable, SSR for SEO/blog/JSON-LD, API routes for the mobile app later |
| ORM | **Drizzle** | No engine binary (1.9 GB RAM), dialect-portable SQL, type-safe |
| Validation | **Zod** | Every boundary, both directions |
| DB (dev/test) | **libSQL** in-process | No Docker available (ADR-004/019) |
| DB (prod) | **Neon Postgres, pooled** | Serverless-safe connection handling |
| Tests | **Vitest** + **fast-check** | Property-based adversarial testing of the calc engine |
| Lint/format | **Biome** | One tool, fast, no config sprawl |
| UI | Tailwind + **shadcn/ui** + Radix + Framer Motion | OS UI mandate; headless a11y; WCAG |
| Email | **Resend** | Free tier, ADR-016 |
| Logging | **Pino** structured JSON | Sentry seam built now, DSN added Phase 4 |

---

## 2. TRUST BOUNDARIES

```
┌──────────────────────── PUBLIC (no auth) ────────────────────────┐
│ Home · Product list · Product detail · Lab (preview calc) · Blog │
│                                                                  │
│  ⚠️ The Lab calculator is PUBLIC and read-only.                  │
│     It must not persist, and must not accept a price as input.   │
└───────────────────────────────┬──────────────────────────────────┘
                                │ Zod-validated JSON
┌───────────────────────────────▼──────────────────────────────────┐
│                    CUSTOMER (session auth)                        │
│ Cart · Checkout · Orders · Track · Cancel · Account · Reviews     │
│ Referral code + free-delivery credits                             │
└───────────────────────────────┬──────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────┐
│              ADMIN — role=ADMIN (owner, global)                   │
│  All stores · all customers · all costs/margins · store settings  │
│  · staff invites · soft-delete · audit log · price checker        │
├───────────────────────────────────────────────────────────────────┤
│        ADMIN — role=MANAGER (store-scoped, ADR-014)               │
│  Own store only: products, ingredient rates, inventory, orders,   │
│  coupons, blog, reports. NO store settings, NO invites, NO delete │
└───────────────────────────────────────────────────────────────────┘
```

**Rule:** the store filter is applied by **server-side middleware**, never from a
client-supplied `storeId` alone. Every query for a MANAGER is constrained to
`store_id IN (assigned stores)` regardless of what the request claims.

---

## 3. THE CALCULATION ENGINE (core of the product)

A **pure, side-effect-free module**. No DB, no I/O, no clock, no randomness.
Everything else in the app is CRUD; this is the part that must be correct.

```
                 ┌──────────────────────────────┐
 ingredient ───▶ │                              │ ──▶ normalised ratios (bps, Σ=10000)
 weights (g)     │   1. NORMALISE               │ ──▶ validation errors (over/under)
 target size     │                              │
                 └──────────────────────────────┘
                                 │
                 ┌───────────────▼──────────────┐
                 │   2. SCALE TO PACK SIZE      │ ──▶ exact grams per ingredient
                 │      (integer, mass-         │     Σ grams === target grams
                 │       conserving)            │
                 └───────────────┬──────────────┘
                    ┌────────────┴────────────┐
   ┌────────────────▼──────────┐   ┌──────────▼─────────────────┐
   │ 3a. NUTRITION             │   │ 3b. PRICE                  │
   │ Σ(ratio_bps × value)/10⁴  │   │ Σ(g × sell_paise/kg)/1000  │
   │ per 100 g, all nutrients  │   │ + milling + packaging      │
   │ HARD FAIL on missing data │   │ (delivery+GST at checkout) │
   │ (R1.3 "Vitality Rule")    │   │ + per-line breakdown       │
   └────────────────┬──────────┘   └──────────┬─────────────────┘
                    └────────────┬────────────┘
                    ┌────────────▼───────────────────────────────┐
                    │ 4. RESULT — customer-visible                │
                    │   composition %, nutrition panel, price     │
                    │   breakdown. Snapshotted into the order.    │
                    └─────────────────────────────────────────────┘
```

### Formulae (verified against the client's sheet)

**Nutrition** — ratio-weighted mean per 100 g. *Confirmed correct by
reproducing 4 of the client's 5 blend panels to 2 decimal places:*
```
nutrient_per_100g = Σ(ratio_bps_i × nutrient_per_100g_i) / Σ(ratio_bps_i)
```

**Price** (ADR-008):
```
line_paise   = Σ( weight_g_i × sell_paise_per_kg_i ) / 1000
milling      = ceil(total_g / 1000) × store.milling_fee_paise_per_kg
packaging    = package_count × store.packaging_fee_paise
subtotal     = line + milling + packaging
delivery     = store.delivery_fee_paise        -- ONCE per order
gst_paise    = roundHalfUp(subtotal_total × gst_bps / (10000 + gst_bps))   -- inclusive
total        = subtotal_total + delivery
```

### Invariants (enforced by fast-check, not by comments)
1. **Mass conservation:** `Σ(weight_g_i) === total_g` exactly, as integers
2. **Percentage closure:** `Σ(ratio_bps_i) === 10000` exactly
3. **Unit safety:** kg↔g conversion happens in exactly one helper
4. **Cost monotonicity:** raising any ingredient's rate cannot lower mix price
5. **No silent zeros:** a missing price or nutrient **throws**, never yields 0 (R1.3)
6. **Base-grain floor:** customer mixes enforce `base_grain_bps ≥ store.min_base_grain_bps`
7. **Per-ingredient caps:** `ratio_bps_i ≤ ingredient.max_pct_bps`
8. **Determinism:** same input → byte-identical output (enables snapshot tests)
9. **Idempotent normalisation:** `normalise(normalise(x)) === normalise(x)`
10. **Rounding stability:** Σ of displayed line prices === displayed total
    (no off-by-one-paise from independent rounding)

Invariant 10 is the one most e-commerce systems get wrong and it is directly
visible on an invoice.

---

## 4. ORDER FLOW

```
CUSTOMER                              SYSTEM                        ADMIN
   │ build mix / pick product           │                              │
   ├───────────────────────────────────▶│ validate (Zod + engine)      │
   │ checkout: address, COD|UPI         │ RECOMPUTE price server-side  │
   ├───────────────────────────────────▶│ snapshot price+nutrition     │
   │                                    │ create order = PLACED        │
   │                                    ├──── Resend email ───────────▶│ 🔔 in-app + email
   │                                    │                              │
   │  [UPI]  server-generated QR ◀──────┤                              │
   │  scan & pay in own UPI app         │  AWAITING_VERIFICATION       │
   ├──── optional UPI ref number ──────▶│                              │ checks bank app
   │                                    │◀───── "Mark as Paid" ────────┤
   │                                    │  payment = PAID              │
   │                                    │                              ├─ contacts miller
   │                                    │◀──── PREPARING ──────────────┤
   │  ❌ cancel window CLOSES           │◀──── PREPARED ───────────────┤
   │                                    │◀──── SHIPPED (driver) ───────┤
   │                                    │◀──── DELIVERED ──────────────┤ confirms w/ driver
   │                                    │  COD → payment = PAID        │
   │                                    │◀──── CLOSED ─────────────────┤
   │                                    │  ⛔ IMMUTABLE → archive      │
   │  track timeline at every step ◀────┤  (order_status_events)       │
```

Cancellation is permitted **only while fulfilment status < PREPARED**.
`DELIVERY_FAILED / RTO` branches off `SHIPPED` and is recorded, never deleted.

---

## 5. DATA FLOW — TENANCY

```
request → session → { userId, role, storeIds[] }
                          │
              ┌───────────▼────────────┐
              │  STORE SCOPE MIDDLEWARE │  ADMIN  → no filter (all stores)
              │  (server-side only)     │  MANAGER→ store_id IN storeIds
              └───────────┬────────────┘  CUSTOMER→ own orders only
                          │
              every query is constrained here, not in the UI
```

`store_id` is a **partition key by design** (ADR-003): if physical separation is
ever required, the data slices cleanly without a rewrite.

---

## 6. SEO / GEO (client asked for both)

- SSR for product pages, blog, and the Lab's shareable mix permalinks
- `sitemap.xml` + `robots.txt` generated per store
- JSON-LD: `Product`, `Offer`, `AggregateRating`, `Article`, `BreadcrumbList`,
  `Organization` (with FSSAI licence number once supplied)
- Per-product and per-post `seo_title` / `seo_description` / OG image, admin-editable
- Blog is admin-authored markdown (ADR-014 lets managers write posts)
- **Nutrition panels are crawlable HTML, not canvas images** — this is the main
  GEO/AI-answer lever: a machine-readable composition table is exactly what an
  LLM answering "which atta is high in fibre" needs

---

## 7. DEPLOYMENT

| | Dev / Test | Production |
|---|---|---|
| DB | libSQL file, in-process | Neon Postgres **pooled** |
| Runtime | Node 20 | Netlify (Node functions, not Edge — Drizzle + libSQL need Node). Host-agnostic: any Node runtime works |
| Email | logged to console | Resend |
| Migrations | `drizzle-kit` generate + apply, versioned | applied in deploy step, **never auto-generated in prod** |

**Rollback rule (Phase 4):** every migration ships with a written down-migration.
A migration that cannot be reversed is a 🔴 RED tier change requiring approval.

---

## 8. WHAT IS DELIBERATELY ABSENT

No payment gateway, no webhook receiver, no idempotency-key store, no return/RMA
subsystem, no search index, no queue/scheduler at launch, no Docker.
Each is a recorded non-goal with a reason (ADR-018), not an oversight.
