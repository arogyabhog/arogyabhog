# 04 — DATABASE SCHEMA (living source of truth)

**Status: DRAFT — awaiting client review.** No migrations generated yet.

Conventions (see `00_SYSTEM_RULES.md` R1):
- All money → `INTEGER` **paise**. All weight → `INTEGER` **grams**.
  All percentages/rates → `INTEGER` **basis points** (5% = 500, 60% = 6000).
- `store_id` on every tenant-scoped table + index (ADR-003).
- Snapshots on order data, never live references alone (R3).
- Append-only tables: `order_status_events`, `audit_log`, `inventory_movements`,
  `referrals`, `coupon_redemptions`.
- **No Postgres-only features** (ADR-004): no `EXCLUDE`, no DB-level RLS, no `MONEY`.
- Soft delete (`is_active` / `deleted_at`) for products and ingredients — never
  hard delete, because historical orders reference them.

---

## Tenancy & identity

### `stores`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | `ArogyaBhog Kanpur` |
| `city`, `state` | text | |
| `slug` | text UNIQUE | used in URLs & store switcher |
| `gstin` | text NULL | if GST-registered (ADR-009, open) |
| `upi_vpa` | text NULL | **per store** (ADR-006) |
| `upi_payee_name` | text | default `ArogyaBhog` |
| `upi_mcc` | text | default `5411` |
| `delivery_fee_paise` | int | default `5000` (ADR-010) |
| `packaging_fee_paise` | int | default `500` (ADR-010) |
| `milling_fee_paise_per_kg` | int | default `400` (ADR-010) |
| `gst_rate_bps` | int | default `500` |
| `min_base_grain_bps` | int | default `6000` (ADR-013) |
| `referral_credit_cap` | int | default `10` (ADR-017) |
| `referee_bonus_credits` | int | default `1` — extra credits when joining via a code (ADR-017) |
| `allowed_pack_sizes_g` | json | `[5000,10000,15000,20000]` — **mix sizes.** Standard products are `10000/15000/20000` only (ADR-021) |
| `is_active` | bool | |
| `created_at`, `updated_at` | timestamptz | |

### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `email` | text UNIQUE NULL | login for customers & staff |
| `phone` | text NULL | UNIQUE — required for delivery contact |
| `password_hash` | text | argon2id, never bcrypt-truncated |
| `name` | text | |
| `role` | text enum | `ADMIN` \| `MANAGER` \| `CUSTOMER` (ADR-014) |
| `referral_code` | text UNIQUE | stable, non-guessable (ADR-017) |
| `free_delivery_credits` | int | default `1`; `1 + store.referee_bonus_credits` when `referred_by_user_id` is set (ADR-017) |
| `referred_by_user_id` | uuid FK→users NULL | |
| `is_active` | bool | |
| `created_at`, `last_login_at` | timestamptz | |

Index: `(role)`, `(referred_by_user_id)`.

### `user_store_access`  — managers scoped to N stores
`user_id` FK, `store_id` FK, `granted_by` FK→users, `granted_at`. PK `(user_id, store_id)`.
**ADMIN rows are omitted** — ADMIN is global by role, not by enumeration.

### `addresses`
`id`, `user_id` FK, `store_id` FK, `label`, `line1`, `line2`, `landmark`, `city`,
`state`, `pincode`, `phone`, `is_default`, `created_at`. Index `(user_id)`.

---

## Catalog

### `ingredients`  — **global** (the what), separated from price (the how-much)
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `slug` | text UNIQUE | |
| `name` | text | `Whole Wheat (Sharbati Gehu)` |
| `name_hi` | text NULL | Hindi display name |
| `category` | text enum | `BASE_GRAIN` \| `MILLET` \| `PULSE` \| `SEED` \| `OILSEED` \| `FIBRE` \| `SPICE` |
| `is_base_grain` | bool | counts toward the 60% floor (ADR-013) — **open: which qualify** |
| `max_pct_bps` | int NULL | per-ingredient cap, e.g. seeds 1500, psyllium 300 |
| `min_pct_bps` | int NULL | optional floor |
| `allergen_tags` | json | e.g. `["soy","gluten"]` — Soybean, wheat |
| `ifct_code` | text NULL | e.g. `A019`, `H011`, `G026` (ADR-007) |
| `is_active` | bool | soft delete |
| `data_complete` | **generated bool** | 🔴 false if any price or nutrient missing |

> **`data_complete` is the Vitality Rule made structural (R1.3).** An ingredient
> with incomplete data is **excluded from the customer-facing Lab** rather than
> silently computed as zero. This single column is what prevents the defect found
> in the client's sheet from ever reaching a customer.

Why global: nutrition data must not be duplicated per city, and the ingredient
*catalog* is one thing even when *prices* differ by store.

### `ingredient_nutrients`  — one row per (ingredient, nutrient)
| Column | Type | Notes |
|---|---|---|
| `ingredient_id` | FK | PK part |
| `nutrient_code` | text | PK part. IFCT codes: `enerc`, `protcnt`, `fatce`, `choavldf`, `fibtg`, `ca`, `fe`, `zn`, `mg`, `p`, `na`, `k`, `thia`, `ribf`, `nia`, `folsum`, `cartbeq`, `fasat`, `fapu`, `facn3` |
| `value_per_100g_scaled` | int | **integer, pre-scaled** — see note |
| `scale_factor` | int | divisor to recover the display unit |
| `display_unit` | text | `kcal`, `g`, `mg`, `ug` |
| `source` | text enum | `IFCT2017` \| `USDA` \| `CLIENT` \| `LAB` (ADR-007) |
| `source_ref` | text | IFCT food code / USDA FDC id / URL |
| `verified_at` | timestamptz | |

PK `(ingredient_id, nutrient_code)`. **UNIQUE per source** — one ingredient may not
have two values for the same nutrient (R5).

> **Unit traps encoded structurally, not in prose (ADR-007):** IFCT energy is
> **kJ** (÷4.184 → kcal) and minerals are stored in **grams** with per-nutrient
> factors (Ca ×1000 → mg, Zn ×10⁶ → µg). The ETL applies these once, at ingest,
> and stores the already-converted integer plus its scale. Application code never
> converts units.

### `ingredient_prices`  — **per store**, admin-editable (ADR-008, ADR-014)
| Column | Type | Notes |
|---|---|---|
| `store_id` | FK | PK part |
| `ingredient_id` | FK | PK part |
| `cost_paise_per_kg` | int | admin/manager-editable; drives margin reports |
| `sell_paise_per_kg` | int | **drives custom-mix pricing**; customer-visible in breakdown |
| `effective_from` | timestamptz | PK part — enables price history |
| `created_by` | FK→users | |

PK `(store_id, ingredient_id, effective_from)`. Index `(store_id, ingredient_id, effective_from DESC)`.
Every edit **inserts a new row** rather than updating — price history is free, and
`audit_log` records the actor. Current price = latest `effective_from ≤ now`.

### `products`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `store_id` | FK | |
| `slug` | text | UNIQUE `(store_id, slug)` |
| `name` | text | **editable content, never an enum** (ADR-020) |
| `tagline`, `description_md` | text | editable health copy (ADR-020) |
| `product_type` | text enum | `STANDARD` \| `PREMADE_MIX` |
| `hsn_code` | text | default `11010000` |
| `gst_rate_bps` | int | per-product override of store default (ADR-009) |
| `image_url`, `seo_title`, `seo_description` | text | |
| `is_best_seller`, `is_active` | bool | homepage + soft delete |
| `sort_order` | int | |
| `created_at`, `updated_at` | timestamptz | |

### `product_variants`  — pack sizes
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `product_id` | FK | |
| `pack_size_g` | int | standard: `10000/15000/20000`; 5 kg is mix-only (ADR-001, BLOCKER-4) |
| `sku` | text | UNIQUE `(product_id, pack_size_g)` |
| `price_paise` | int | **GST-inclusive** displayed price (ADR-009) |
| `compare_at_price_paise` | int NULL | strikethrough MRP |
| `cost_paise` | int NULL | admin-entered (C3) |
| `package_count` | int | how many physical bags → packaging fee (ADR-010) |
| `stock_qty` | int | finished-goods count |
| `is_active` | bool | |

### `product_recipes`  — premade blend composition
`product_id` FK, `ingredient_id` FK, `ratio_bps` int. PK `(product_id, ingredient_id)`.
**CHECK `ratio_bps > 0`.** Unrestricted percentages for admin blends (ADR-013).
Used for: nutrition derivation, margin computation, and the **Price Consistency
Checker** (ADR-008).

---

## Custom mixes

### `custom_mixes`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `store_id` | FK | |
| `user_id` | FK NULL | NULL for anonymous Lab previews that are later claimed |
| `name` | text NULL | customer's label |
| `total_weight_g` | int | must equal an `allowed_pack_sizes_g` value |
| `base_grain_bps` | int | computed; ≥ `store.min_base_grain_bps` |
| `package_count` | int | |
| `line_paise`, `milling_paise`, `packaging_paise`, `subtotal_paise` | int | ADR-008 |
| `nutrition_json` | json | **snapshot** at creation (R3) |
| `price_breakdown_json` | json | **snapshot** — what the customer saw |
| `engine_version` | text | which calc version produced this |
| `share_slug` | text UNIQUE NULL | SEO/shareable permalink |
| `created_at` | timestamptz | |

### `custom_mix_items`
`mix_id` FK, `ingredient_id` FK, `weight_g` int, `ratio_bps` int,
`sell_rate_paise_per_kg_snapshot` int, `line_paise` int. PK `(mix_id, ingredient_id)`.
**Rate is snapshotted** — a later admin price change must not alter an existing mix.

---

## Cart & orders

### `carts` / `cart_items`
`carts`: `id`, `user_id` FK UNIQUE, `store_id` FK, `created_at`, `updated_at`.
`cart_items`: `id`, `cart_id` FK, `item_type` (`PRODUCT`\|`CUSTOM_MIX`),
`product_variant_id` NULL, `custom_mix_id` NULL, `qty` int, `added_at`.
CHECK: exactly one of the two FKs is non-null.

> A cart is **single-store**. Mixing Kanpur and Delhi items in one cart is
> impossible by construction — one delivery fee, one driver, one fulfilment.

### `orders`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `order_number` | text UNIQUE | human: `AB-KNP-000123` |
| `store_id` | FK | |
| `user_id` | FK | |
| `fulfilment_status` | text enum | `PLACED` `PREPARING` `PREPARED` `SHIPPED` `DELIVERED` `CLOSED` `CANCELLED` `DELIVERY_FAILED` (ADR-012) |
| `payment_status` | text enum | `UNPAID` `AWAITING_VERIFICATION` `PAID` `REFUNDED_NA` — **separate axis** |
| `payment_method` | text enum | `COD` \| `UPI_QR` |
| `subtotal_paise`, `packaging_paise`, `delivery_paise`, `discount_paise`, `gst_paise`, `cgst_paise`, `sgst_paise`, `total_paise` | int | |
| `free_delivery_credit_used` | bool | ADR-017 |
| `coupon_id` | FK NULL | |
| `address_snapshot_json` | json | **snapshot** (R3) |
| `upi_intent_uri` | text NULL | server-generated (ADR-006) |
| `upi_ref_from_customer` | text NULL | customer-submitted UPI reference |
| `upi_verified_by` | FK→users NULL | |
| `upi_verified_at` | timestamptz NULL | |
| `placed_at`, `prepared_at`, `shipped_at`, `delivered_at`, `closed_at`, `cancelled_at` | timestamptz NULL | |
| `cancel_reason` | text NULL | |
| `driver_note`, `admin_note` | text NULL | |
| `is_archived` | bool | true once `CLOSED` (client requirement #10) |

Indexes: `(store_id, fulfilment_status, placed_at DESC)` — the admin order queue;
`(store_id, payment_status)` — the payments reconciliation queue; `(user_id, placed_at DESC)`.

**Immutability (R3, client #10):** once `CLOSED`, application-level guard rejects
all UPDATEs except `admin_note`. Enforced in the repository layer *and* by test.

### `order_items`
`id`, `order_id` FK, `item_type`, `product_variant_id` NULL, `custom_mix_id` NULL,
`name_snapshot` text, `pack_size_g` int, `qty` int, `unit_price_paise` int,
`line_total_paise` int, `gst_rate_bps` int, `cost_snapshot_paise` int NULL,
`price_breakdown_json` json NULL (custom mixes). All snapshots (R3).

### `order_status_events`  — append-only timeline
`id`, `order_id` FK, `from_status` NULL, `to_status`, `axis` (`FULFILMENT`\|`PAYMENT`),
`changed_by_user_id` FK, `note`, `created_at`. **Never UPDATEd or DELETEd.**
This is what the customer-facing "track your order" view renders.

---

## Inventory

### `inventory_movements`  — append-only (C6: raw-ingredient tracking)
`id`, `store_id` FK, `ingredient_id` FK, `delta_g` int (signed),
`reason` enum (`PURCHASE` `CONSUMED_BY_ORDER` `WASTAGE` `ADJUSTMENT` `RETURN_TO_STOCK`),
`order_id` FK NULL, `note`, `created_by` FK→users, `created_at`.
Current stock = `SUM(delta_g)` grouped by `(store_id, ingredient_id)`.

> **Design choice:** stock is a **derived sum of movements**, not a mutable
> counter. A mutable counter silently loses updates under concurrency; a movement
> ledger is auditable, correctable, and gives the client a full history of what
> was consumed by which order. This is what "manage inventory" actually means for
> a business that mills to order (Q6 resolution).

Placing an order writes negative `CONSUMED_BY_ORDER` movements for each ingredient
in each custom mix, inside the same transaction as order creation.

---

## Marketing

### `coupons`
`id`, `store_id` FK, `code` UNIQUE `(store_id, code)`,
`type` enum (`PERCENT` `FLAT` `FREE_DELIVERY`), `value` int (bps or paise),
`min_order_paise` int NULL, **`max_discount_paise` int NULL** ← abuse cap (ADR-014),
`usage_limit` int NULL, `used_count` int, `per_user_limit` int NULL,
`starts_at`, `expires_at`, `is_active`, `created_by` FK→users, `created_at`.

### `coupon_redemptions`  — append-only
`coupon_id` FK, `order_id` FK, `user_id` FK, `discount_paise` int, `redeemed_at`.
PK `(coupon_id, order_id)`. Enforces `per_user_limit` via count.

### `referrals`  — append-only (ADR-017, ✅ resolved 2026-10-10)
`id`, `referrer_user_id` FK, `referee_user_id` FK **UNIQUE**,
`status` enum (`PENDING` `CREDITED` `REJECTED`), `created_at`,
`credited_at` NULL, `credited_order_id` FK NULL, `reject_reason` NULL.
`UNIQUE(referee_user_id)` — a user can only ever be referred once.
Self-referral blocked by CHECK (`referrer_user_id <> referee_user_id`).

**Lifecycle:** row created `PENDING` at referee signup → flipped to `CREDITED`
when the referee's **first order reaches `DELIVERED`**, at which point the
referrer's `free_delivery_credits` increments **only if below
`store.referral_credit_cap`**. Awarding on a delivered order rather than on signup
is the primary abuse control — fake accounts never produce a delivered order.
Both the referral and the credit increment are written to `audit_log`.

> Concurrency note: the credit increment and the status flip must happen in the
> **same transaction** as the order's `DELIVERED` transition, and the increment
> must be a guarded conditional update (`WHERE credits < cap`). Otherwise two
> concurrent deliveries for the same referrer can both read the same count and
> over-award past the cap. This is a property test, not a comment.

---

## Content & governance

### `reviews`
`id`, `store_id` FK, `product_id` FK, `user_id` FK, `order_id` FK,
`rating` int CHECK 1..5, `title`, `body`, `is_verified_purchase` bool,
`status` enum (`PENDING` `PUBLISHED` `REJECTED`), `admin_note`, `created_at`.
**UNIQUE `(order_id, product_id, user_id)`** — one review per purchased line.
Admin-moderated before publish (prevents injection into public pages, R2/R10).

### `blog_posts`
`id`, `store_id` FK NULL (**NULL = global**, visible to all stores), `slug`,
`title`, `excerpt`, `body_md`, `cover_url`, `tags` json, `seo_title`,
`seo_description`, `status` enum (`DRAFT` `PUBLISHED`), `published_at`,
`author_user_id` FK, `created_at`, `updated_at`. UNIQUE `(store_id, slug)`.
Managers may author (ADR-014).

### `audit_log`  — append-only (ADR-015, MANDATORY)
`id`, `store_id` FK NULL, `actor_user_id` FK, `actor_role`, `entity_type` text,
`entity_id` text, `action` enum (`CREATE` `UPDATE` `DELETE` `LOGIN` `EXPORT`),
`before_json` json NULL, `after_json` json NULL, `ip` text, `user_agent` text,
`created_at`. Index `(entity_type, entity_id, created_at DESC)`, `(actor_user_id, created_at DESC)`.
CSV-exportable for the client's "list of what we changed".

### `notifications`
`id`, `user_id` FK, `store_id` FK NULL, `type` text, `title`, `body`,
`link` NULL, `channel` enum (`IN_APP` `EMAIL`), `sent_at` NULL, `read_at` NULL,
`created_at`. Index `(user_id, read_at, created_at DESC)`.

---

## Migration rules (OS §6)

1. Migrations are **versioned and committed**; never auto-generated in production.
2. Every migration ships with a **written down-migration** (Phase 4 rollback rule).
3. Access grants and constraints land **in the same migration** as the table.
4. Adding a column to `orders` or `order_items` is 🟡 YELLOW (blast radius: every
   historical invoice). Changing a money column's meaning is 🔴 RED.
5. Seed jobs are **idempotent** — stable UUIDs + `UPSERT`, safe to re-run (OS §6).

---

## Amendment 2026-10-11 (ADR-026) — ingredient rate provenance

`ingredients` gains three columns so that no derived number can ever pose as a
client-set one:

| Column | Type | Notes |
|---|---|---|
| `cost_source` | TEXT NOT NULL DEFAULT `'client_sheet_2026'` | `'client_sheet_2026'` \| `'market_mandi_2026_08'` \| `'client'` |
| `sell_source` | TEXT NOT NULL DEFAULT `'seed_home_blend_k'` | `'seed_home_blend_k'` \| `'seed_home_blend_k_on_market_cost'` \| `'market_override'` \| `'client'` |
| `rates_provisional` | BOOLEAN NOT NULL DEFAULT `true` | cleared only by an admin edit, which also sets `*_source='client'` and writes an audit row |

Seed data: `discovery/seed-ingredient-rates.json` (18 rows, paise, provenance
per row). CHECK constraint: `sell_paise_per_kg > 0 AND cost_paise_per_kg > 0`
(R1.3 — a zero rate must be impossible to store, not merely refused by the API).
