# 06 — API CONTRACTS

**Status: DRAFT — awaiting review.** All payloads validated with **Zod at the route
edge** (`00_SYSTEM_RULES.md` R2). Money is **paise**, weight is **grams**, rates are
**basis points** — integers everywhere, never floats (R1).

Convention: `/api/storefront/*` (public + customer), `/api/admin/*` (ADMIN | MANAGER).
Every `/api/admin/*` route passes through **store-scope middleware** (ADR-003/014).

---

## 1. THE CORE CONTRACT — mix calculation

The single most important endpoint in the system. Public, read-only, **never
persists**, and **never accepts a price as input**.

### `POST /api/storefront/mix/calculate`

**Request**
```jsonc
{
  "storeId": "uuid",
  "targetWeightG": 10000,          // must be in store.allowed_pack_sizes_g
  "packageCount": 1,               // ADR-010: packaging is per package
  "items": [
    { "ingredientId": "uuid", "weightG": 6000 },   // 60% base grain
    { "ingredientId": "uuid", "weightG": 1500 },
    { "ingredientId": "uuid", "weightG": 1500 },
    { "ingredientId": "uuid", "weightG": 1000 }
  ]
}
```

Zod constraints:
- `items` length 2..12, no duplicate `ingredientId`
- every `weightG` integer `> 0`
- `Σ weightG === targetWeightG` **exactly** (R1.1 mass conservation)
- `targetWeightG ∈ store.allowed_pack_sizes_g`
- `Σ(ratio_bps of is_base_grain items) ≥ store.min_base_grain_bps` (ADR-013)
- each `ratio_bps ≤ ingredient.max_pct_bps` (ADR-013)
- every referenced ingredient has `data_complete = true` (R1.3)

**Response 200**
```jsonc
{
  "targetWeightG": 10000,
  "packageCount": 1,
  "baseGrainBps": 6000,
  "composition": [
    {
      "ingredientId": "uuid",
      "name": "Whole Wheat (Sharbati Gehu)",
      "weightG": 6000,
      "ratioBps": 6000,
      "displayPercent": "60.0%",
      "sellRatePaisePerKg": 6800,
      "linePaise": 40800
    }
    // ...
  ],
  "nutrition": {
    "per100g": [
      { "code": "enerc",   "label": "Energy",    "value": 34893, "scale": 100, "unit": "kcal" },
      { "code": "protcnt", "label": "Protein",   "value": 1351,  "scale": 100, "unit": "g" },
      { "code": "ca",      "label": "Calcium",   "value": 6120,  "scale": 100, "unit": "mg" },
      { "code": "fe",      "label": "Iron",      "value": 438,   "scale": 100, "unit": "mg" }
      // ... all nutrients present for every ingredient
    ],
    "perServing": null,          // optional, later
    "rdaPercent": [ { "code": "ca", "percentBps": 765 } ],  // IFCT RDA intakes
    "sources": ["IFCT2017", "USDA"],                        // provenance (ADR-007)
    "estimated": true                                       // never presented as lab-analysed (R9)
  },
  "pricing": {
    "linePaise": 61200,
    "millingPaise": 4000,       // ceil(10000/1000) x 400
    "packagingPaise": 500,      // 1 package x 500 (ADR-010)
    "subtotalPaise": 65700,
    "gstRateBps": 500,
    "gstInclusivePaise": 3129,  // subtotal x 500 / 10500, roundHalfUp (ADR-009)
    "totalPaise": 65700,        // GST-INCLUSIVE pricing: tax is inside, not added
    "deliveryPaise": 5000,      // quoted, applied ONCE at order level
    "currency": "INR"
  },
  "engineVersion": "1.0.0"
}
```

**Error responses** — each a distinct, typed code, never a silent zero:

| HTTP | `code` | When |
|---|---|---|
| 422 | `MASS_MISMATCH` | `Σ weightG !== targetWeightG`; body includes `deltaG` so the UI can say "add 400 g" / "remove 250 g" (client requirement C1/#2) |
| 422 | `INVALID_PACK_SIZE` | target not in `allowed_pack_sizes_g` |
| 422 | `BASE_GRAIN_BELOW_MINIMUM` | body includes `actualBps`, `requiredBps` |
| 422 | `INGREDIENT_OVER_CAP` | body includes `ingredientId`, `actualBps`, `maxBps` |
| 409 | `INCOMPLETE_INGREDIENT_DATA` | 🔴 **the Vitality Rule (R1.3)** — an ingredient lacks a price or a nutrient. Body names exactly which ingredient and which field. **Never computes on partial data.** |
| 409 | `INGREDIENT_UNAVAILABLE` | `is_active = false` at this store |

> The `MASS_MISMATCH` payload is what drives the client's requested UX: *"if the
> value is high tell the user to remove, if low tell them to add, as per the
> percentage of the mixture."* `deltaG` plus current `ratioBps` lets the UI suggest
> a proportional top-up rather than making the customer do arithmetic.

### `POST /api/storefront/mix/normalise`
Takes arbitrary ingredient **ratios** (no weights) plus a target size and returns
exact integer grams that sum precisely to the target. This is the "build a ratio,
pick a size, we scale it" UX proposed in ADR-013 — and the only place where
integer rounding of a proportional split is allowed to happen.

Invariant: `Σ grams === targetG` **exactly**. Largest-remainder allocation, so no
gram is lost to rounding. Property-tested.

---

## 2. Checkout & orders

### `POST /api/storefront/checkout`
**Request**
```jsonc
{
  "storeId": "uuid",
  "addressId": "uuid",
  "paymentMethod": "COD" | "UPI_QR",
  "couponCode": "string?",
  "useFreeDeliveryCredit": true,
  "items": [
    { "type": "PRODUCT",    "variantId": "uuid", "qty": 2 },
    { "type": "CUSTOM_MIX", "mixId": "uuid",     "qty": 1 }
  ]
}
```

**Server behaviour (R2 — the client total is a preview, never an input):**
1. Recompute every line from current DB prices, not from the request
2. Re-run the mix engine against the snapshotted mix and **reject if the result
   differs** from what the customer was shown (stale-price guard)
3. Validate stock; write negative `inventory_movements` in the same transaction
4. Apply coupon (validate limits, `max_discount_paise` cap, stacking rules)
5. Apply delivery fee **once**, waived iff `useFreeDeliveryCredit` and credits > 0
6. Compute GST split CGST/SGST (always intra-state — ADR-009)
7. Snapshot everything into `order_items` (R3)
8. Insert `order_status_events` (`null → PLACED`)
9. Fire notification (Resend + in-app) inside a transactional outbox, not inline

**Response 201** — `orderNumber`, totals, `fulfilmentStatus`, `paymentStatus`, and:
```jsonc
// present only when paymentMethod === "UPI_QR" — SERVER-GENERATED (ADR-006)
"upi": {
  "intentUri": "upi://pay?pa=...&pn=...&am=657.00&cu=INR&tn=Order%20AB-KNP-000123&tr=ABKNP000123&mc=5411",
  "qrSvg": "<svg .../>",
  "amountPaise": 65700,
  "expiresAt": "2026-10-10T14:30:00Z"
}
```
🔴 The QR is **never** constructed client-side. A browser-built QR is a
browser-chosen amount.

### `POST /api/storefront/orders/:id/upi-reference`
Customer submits their UPI transaction reference after paying. Stored as
`upi_ref_from_customer`. Does **not** change `payment_status` — only an admin can
(ADR-006).

### `POST /api/storefront/orders/:id/cancel`
Succeeds **only while `fulfilment_status < PREPARED`** (ADR-012). Returns 409
`CANCELLATION_WINDOW_CLOSED` with the current status otherwise. The check and the
status transition happen in one transaction — otherwise two concurrent requests can
both pass the guard (a real race, and exactly what a property test should catch).

### `GET /api/storefront/orders/:id`
Returns the order plus the **full status timeline** from `order_status_events`
that renders the customer-facing tracker (client requirement #10).

---

## 3. Admin

### Orders & payments
| Endpoint | Notes |
|---|---|
| `GET /api/admin/orders?status=&storeId=&from=&to=` | Store-scoped by middleware. Two saved views: **active queue** (`is_archived = false`) and **records** (`true`) |
| `POST /api/admin/orders/:id/status` | `{ axis, toStatus, note }`. Validates the transition against the ADR-012 machine; **rejects illegal jumps** (e.g. `PLACED → DELIVERED`). Writes an event + audit row. Rejects any change to a `CLOSED` order (R3) |
| `GET /api/admin/payments/awaiting` | UPI orders in `AWAITING_VERIFICATION` — the reconciliation queue |
| `POST /api/admin/payments/:orderId/verify` | Admin marks `PAID` after checking their bank app. Records `upi_verified_by` + `upi_verified_at`. **The only path to `PAID` for UPI** |

### Catalog & pricing
| Endpoint | Notes |
|---|---|
| `GET/POST/PATCH /api/admin/products` | MANAGER allowed for own store (ADR-014). Delete is ADMIN-only soft-delete |
| `GET/PUT /api/admin/ingredients/:id/price` | Per-store `cost` + `sell` paise/kg. **Inserts a new `ingredient_prices` row** rather than updating — price history for free (schema §Catalog). Audited |
| `GET /api/admin/price-consistency` | 🔴 **The ADR-008 arbitrage guard.** For each premade blend, computes what that exact recipe would cost as a custom mix at current selling rates, and reports divergence vs the standard price. This is how BLOCKER-1 becomes visible instead of customer-facing |
| `GET /api/admin/reports/*` | MANAGER: own store only. ADMIN: all stores |

### Staff, coupons, referrals, audit
| Endpoint | Notes |
|---|---|
| `POST /api/admin/staff/invite` | ADMIN only. Mechanism open — email magic-link (Resend) vs admin-created temp password |
| `PATCH /api/admin/staff/:id` | Assign role + `store_id[]` |
| `GET/POST /api/admin/coupons` | Enforces `max_discount_paise` cap (ADR-014 abuse mitigation) |
| `GET /api/admin/referrals` | Pending vs credited; abuse signals (same phone/device, referee never ordered) |
| `GET /api/admin/audit-log?entity=&actor=&from=&to=` | + `?format=csv` — the client's requested "list of what we changed" (ADR-015) |

---

## 4. Public / SEO

| Endpoint | Notes |
|---|---|
| `GET /api/storefront/products?storeId=` | List + filters. **No search endpoint** — non-goal (ADR-018) |
| `GET /api/storefront/products/:slug` | Includes recipe-derived nutrition and JSON-LD |
| `GET /api/storefront/ingredients?storeId=` | Powers the Lab. **Excludes `data_complete = false`** (R1.3) so an incomplete ingredient can never reach a customer |
| `GET /api/storefront/blog`, `/blog/:slug` | SSR + `Article` JSON-LD |
| `GET /mix/:shareSlug` | Shareable custom-mix permalink — SSR, crawlable nutrition table (GEO lever, `02_ARCHITECTURE.md` §6) |
| `GET /sitemap.xml`, `/robots.txt` | Per store |

---

## 5. Contract rules

1. **No endpoint accepts money as input.** Prices, tax, discounts and delivery are
   always computed server-side. The client-displayed total is a preview.
2. Every error is a **typed code** with a machine-readable body — never a bare 500,
   never a silent default.
3. Every mutation writes an `audit_log` row when the actor is ADMIN or MANAGER.
4. Every contract here gets a Zod schema **and** a fast-check property test before
   implementation. The mix engine additionally gets the 10 invariants in
   `02_ARCHITECTURE.md` §3.
5. This document is the contract a future native mobile app builds against
   (ADR-002) — changing it is 🟡 YELLOW at minimum.
