# 03 — DECISION LOG (Architecture Decision Records)

Format: `[Date | Problem | Decision | Trade-offs]`
Every decision below was made with the client or verified against evidence.

---

## ADR-001 · 2026-10-10 · Domain & product shape
**Problem:** What exactly are we building?
**Decision:** A D2C e-commerce web application for *ArogyaBhog*, a pre-launch flour
brand in Kanpur. Two interfaces: customer storefront and admin panel. The
differentiating feature — and the main technical risk — is the **"Lab" /
custom-blend ("Mix Atta")** page, where a customer composes their own flour from
17–18 ingredients and sees live percentage composition, derived nutrition and
derived price. Brand values: authenticity, purity, transparency, health.
**Trade-offs:** A 6-SKU catalog makes most e-commerce machinery (search, complex
faceting, recommendation) unnecessary. The custom-blend engine is where all
engineering depth must go. Accepted: this is a *calculation-critical* app wearing
an e-commerce costume, not the reverse.

---

## ADR-002 · 2026-10-10 · Platform: responsive web only
**Problem:** Web app, desktop app, or mobile app?
**Decision:** Responsive **web only**, mobile-first. No desktop application. A
native mobile app is deferred and will consume the same API.
**Trade-offs:** A separate desktop build for a 6-SKU catalog is pure waste. A
future mobile app is cheap *because* the API is contract-first (see
`06_API_CONTRACTS.md`). Cost of deferral: no push notifications and no offline
mode at launch. Both are acceptable for COD grocery.

---

## ADR-003 · 2026-10-10 · Multi-city tenancy: one database, `store_id` column
**Problem:** Client asked for "one server per city" (Kanpur, later Delhi,
Lucknow) with data scoped to the selected city.
**Decision:** **Single database.** A `stores` table, and a `store_id` foreign key
on every tenant-scoped row. The admin shell has a store switcher; a server-side
middleware guard appends the store filter to every query.
**Trade-offs:**

| | Single DB + `store_id` (chosen) | Separate server per city (rejected) |
|---|---|---|
| Cross-city reports | One query | Must federate N databases |
| Schema migration | Once | N times, forever |
| Infra cost at 3 cities | 1× | 3× |
| Shared customer accounts | Natural | Requires sync |
| Data drift risk | None | High |

The client gets *exactly* the requested behaviour — select Kanpur, see only
Kanpur. `store_id` is already a partition key, so physical separation later is a
slicing exercise, not a rewrite. **Recorded as an explicit non-goal** unless a
legal data-residency requirement emerges.

---

## ADR-004 · 2026-10-10 · Dev/test database: in-process libSQL, Postgres in production
**Problem:** The OS mandates Testcontainers for isolated integration testing, but
this environment has **no Docker daemon** (verified). Sandbox has 1.9 GB RAM.
**Decision:** Development and the entire test suite run against **in-process
libSQL/SQLite** via a file connection. Production targets **Neon Postgres with a
pooled connection string** on Vercel. Swap is a `DATABASE_URL` change only.
**Trade-offs:**
- ✅ Zero-infra integration tests, fast, no daemon, works in CI
- ✅ Solves the missing-Docker constraint entirely
- ❌ **Dialect drift risk.** Postgres-only features are therefore **forbidden** in
  the schema: no native `EXCLUDE` constraints, no database-level RLS, no
  `MONEY` type, no partial-index-only tricks. Overlap/timing constraints move to
  the application layer with explicit tests.
- ❌ No raw SQL in the data layer — ORM (Drizzle) query builder only, so dialect
  differences cannot leak in by accident.
- Mitigation for pooling: Prisma was rejected partly for this reason; Drizzle
  with a libSQL/pg driver adapter has no engine binary and is far lighter on
  1.9 GB RAM.

---

## ADR-005 · 2026-10-10 · Stack
**Problem:** Which TypeScript stack?
**Decision:** Next.js (App Router) · TypeScript strict · **Drizzle ORM** ·
**Zod** for every boundary · **Vitest** + **fast-check** (property-based) ·
Biome for lint/format · Tailwind + shadcn/ui + Radix + Framer Motion for UI ·
**Resend** for email.
**Trade-offs:** Dependency budget kept deliberately small. **Excluded:**
- *Prisma* — heavier engine binary than Drizzle on 1.9 GB RAM, and its
  serverless story needs an extra adapter layer anyway
- *Sentry* — needs a paid DSN; the structured-logging seam is built now so it
  drops in at Phase 4 without refactor
- *shadcn CLI as a dependency* — it is a copy-in component system, not runtime
- *Any payment SDK* — see ADR-006. This alone removes a large dependency class.

---

## ADR-006 · 2026-10-10 · Payments: COD + unsigned UPI intent QR, **no provider**
**Problem:** Client wants COD *and* a QR that pays **directly into their bank
account with no payment provider**.
**Decision:** Verified feasible and adopted. UPI QR is not a proprietary format —
it is a plain URI per NPCI's UPI Linking Specification:

```
upi://pay?pa=<store VPA>&pn=ArogyaBhog&am=1180.00&cu=INR&tn=Order%20AB-1043&tr=AB1043&mc=5411
```

One URI, two surfaces: rendered as a QR for scanning, and as an `<a href>` that
deep-links into the payer's UPI app on mobile. `am` locks the amount in
GPay/PhonePe/Paytm. `tn`/`tr` carry the order number and appear in **both** bank
statements — that is the reconciliation key. VPA is **per store**, since each
city may bank separately. Cost: ₹0. No gateway, no merchant account, no API keys,
no webhook surface, no transaction fees.

**Payment is ADMIN-VERIFIED, never auto-confirmed.** Unsigned intent QRs produce
**no callback** — there is no way for the server to learn that money arrived.
Flow: `UNPAID → AWAITING_VERIFICATION → PAID` (admin clicks "Mark as Paid" after
checking their own bank/UPI app). Fulfilment does **not** begin until `PAID` for
UPI orders.

**Hard rules:**
1. **QR generated server-side only.** A browser-built QR is a browser-chosen
   amount. Zero-trust boundary.
2. Amount tampering remains possible in some apps even with `am`. Admin
   verification by amount + note is the control, **not** the QR.
3. Customer may optionally submit their **UPI reference number** after paying;
   stored against the order to make reconciliation and disputes tractable.
4. "Do not treat an opened intent as proof of payment" — official guidance, and
   the reason rule 1–3 exist.

**Trade-offs:** ₹0 fees and zero supply-chain surface, in exchange for manual
reconciliation. That is a *good* trade for a pre-launch business whose owner
already runs a manual workflow. Cost: admin must check their bank app. Mitigated
by a dedicated "Payments" queue listing UPI orders awaiting verification.

### Recommendation recorded (awaiting client decision)
COD + no returns + made-to-order custom blends leaves one scenario where the
business takes a **total loss**: customer refuses delivery at the door, driver
returns with a blend that cannot be resold. "No return policy" does not prevent
refusal. **Proposed: UPI prepayment required for custom mixes; COD allowed for
standard products.** Zero extra build cost (the QR already exists). A
`DELIVERY_FAILED` / `RTO` status is included regardless, because refusals will
happen and must be recorded for reports.

---

## ADR-007 · 2026-10-10 · Nutrition data: IFCT 2017 primary, USDA fallback, provenance-tagged
**Problem:** Client's sheet has only 8 macronutrients. Client asked for
"protein, minerals, vitamins, carbs and everything". Client approved migrating to
ICMR-NIN data.
**Decision:** **IFCT 2017** (ICMR-NIN, 542 foods, 214 nutrient columns) as the
primary source. Verified coverage against the actual ingredient list:

- ✅ **14 of 18** ingredients matched, including full micronutrients
  (Ca, Fe, Zn, Mg, P, Na, K, Cu, Mn, Se, B1, B2, B3, folate, β-carotene,
  vitamins A/D/K, SFA/MUFA/PUFA, ω-3/6/9) plus RDA reference intakes
- ✅ Two of the sheet's three broken rows are **fixed** by this: White Sesame
  (`H011 Gingelly seeds, white`) and Methi (`G026 Fenugreek seeds`)
- ❌ **4 ingredients absent from IFCT 2017:** **Kuttu/Buckwheat** (40% of
  Thyro-Care — its *main* ingredient), Chia Seeds, Psyllium Husk, Pumpkin Seeds.
  Verified by exhaustive search of IFCT's food list and its entire 21-item
  "Nuts and Oil Seeds" group. These are non-traditional or non-"key" foods under
  ICMR's key-foods sampling method.
- → **USDA FoodData Central** as documented fallback for those 4. This is
  standard practice: the published Indian Nutrient Databank fills IFCT gaps from
  IFCT-2004 then UK/USDA tables.

Every stored nutrient value carries a `source` column
(`IFCT2017 | USDA | CLIENT | LAB`) and a `source_ref`, so the customer-facing
panel can be honest about provenance. The client's sheet already had the right
instinct with its "Data Status" column; this formalises it.

**Two unit traps that would have caused silent 4×–10⁶× errors:**
1. **IFCT energy is in kilojoules.** Wheat atta = `1340` → **320.3 kcal** after
   ÷4.184. Feeding raw would overstate calories 4.2×.
2. **Minerals are stored in grams**, each with its own factor in the
   `representations` table. Wheat calcium `0.03094` → ×1000 = **30.9 mg**. Zinc
   factor is ×10⁶ (µg). Conversions must be data-driven, never hardcoded.

**Rejected alternative:** keeping the sheet's macros and adding only IFCT
micronutrients. The two sources disagree materially (wheat: energy 340 vs 320.3
kcal, protein 12.0 vs 10.57 g, carbs 71.0 vs 64.17 g). A panel mixing sources
would not internally reconcile, and any nutritionist checking it would find the
seam. **One source per nutrient, provenance recorded.**

**Trade-offs:** IFCT is Indian, authoritative and FSSAI-referenced, but incomplete
for this catalog. Mixing sources is a real methodological caveat — mitigated by
provenance tagging and by labelling all figures to customers as *estimated from
published composition tables*, never as lab-analysed.

**Brand asset surfaced by the data:** Ragi = **364 mg calcium**/100 g, white
sesame = **1283 mg**/100 g, Bengal gram = **25.2 g fibre**. Real, citable,
ICMR-sourced differentiators for a health-positioned brand.

---

## ADR-008 · 2026-10-10 · Custom-mix pricing: derived from ingredient *selling* rates
**Problem:** How is a custom blend priced? Sheet had no logic — the "My Choice"
tab hardcodes ₹950/10 kg (identical to Everyday Atta) while its ingredient rows
are empty, reporting a fictional **90.5% margin on nothing**.
**Decision (client, C3):** Admin enters **both a cost price and a selling price
per kg for every ingredient**. Custom-mix price is derived:

```
raw        = Σ( ingredient_weight_g × ingredient_sell_paise_per_kg ) / 1000
+ milling  = total_weight_kg × store.milling_fee_paise_per_kg
+ packaging= number_of_packages × store.packaging_fee_paise
= subtotal (per line)
+ delivery = store.delivery_fee_paise, ONCE per order (not per package)
GST 5% inclusive → total
```

No separate margin multiplier: **margin is embedded in the per-ingredient selling
rate.** The **full line-by-line breakdown is shown to the customer** — ingredient,
weight, rate/kg, line price — plus the nutrition panel. This directly serves the
brand value of *transparency*.

Standard products are priced independently (admin enters cost + selling price per
variant), **not** derived from their recipe.

**🔴 Known unresolved consequence — BLOCKER-1.** Because ingredient rates span
**₹35/kg (wheat) to ₹850/kg (pumpkin seed), a 24× spread**, no single uniform
markup makes derived mix prices match standard MRPs. Verified numerically — the
required markup per blend ranges **1.378× to 2.036× (48% divergence)**.
Consequences measured against the client's own catalog:

- At 1.94× (Everyday-calibrated): a customer rebuilding **Thyro-Care** in the Lab
  pays **₹2,305 vs the ₹1,650 premade price — 40% more for an identical recipe**
- At 1.38× (Thyro-calibrated): the same customer rebuilding **Everyday Atta**
  pays **₹688 vs ₹950 — a ₹262 margin leak** on the client's best-margin product

This is *especially* visible because the client wants premade mixes displayed **on
the same page** as the Lab.

**Mitigation adopted (build now):** an admin-facing **Price Consistency Checker**.
For each standard blend it computes what that exact recipe would cost as a custom
mix and flags divergence beyond a threshold. Cheap to build, and it converts an
invisible pricing contradiction into a visible admin warning. Ingredient selling
rates must then be tuned **individually**, not by uniform markup. Awaiting client
input on the 18 rate values.

**Trade-offs:** Transparent, admin-controlled, no magic multiplier — but it makes
pricing a *tuning* problem the client must actively manage. The checker exists so
it cannot silently drift.

---

## ADR-009 · 2026-10-10 · GST: 5% inclusive, admin-editable, CGST/SGST split
**Problem:** GST treatment. Client: "keep everything in 5% GST tag, even the
mixture", and "go with the safe idea".
**Decision:** Displayed prices are **GST-inclusive** (the "safe" choice — showing
₹1,650 then adding ₹82.50 at checkout causes abandonment). Rate stored as
`gst_rate_bps` per product, **admin-editable**, never a hardcoded constant.
Invoices split **CGST 2.5% / SGST 2.5%** — all sales are city-local by own
drivers, therefore always **intra-state, never IGST**. HSN `11010000`.
GST component of an inclusive price: `total × rate / (10000 + rate)`.
**Trade-offs:** Branded pre-packaged atta is 5% (loose/unbranded is exempt), but a
**multi-grain blend with seeds may not classify as "wheat or meslin flour"** and
could fall under proprietary food at a different rate. Storing the rate per
product means a CA can correct it later **without a code change**. Client will
have CA review.
**Open:** whether the client is GST-registered (determines whether GSTIN appears
on invoices, and whether GST should be shown at all if unregistered).

---

## ADR-010 · 2026-10-10 · Fees: delivery ₹50/order, packaging ₹5/package, milling ₹4/kg
**Problem:** Fee semantics were contradictory between the brief and the sheet.
**Decision (client, C2 + #8):**
- **Delivery: ₹50 flat per ORDER** — not per package, not per item. Admin-
  configurable per store. Supersedes the sheet's "per packet" note.
- **Packaging: ₹5 flat per PACKAGE**, independent of package size — 5 kg, 10 kg
  and 20 kg all cost ₹5. Admin-configurable per store.
- **Milling & roasting: ₹4 per kg**, kept as a **separate line item** from grain
  cost (client: "grain and milling will be separated").
- Packaging is included in cost-of-goods; it is **not** charged again at
  checkout (double-charge risk explicitly designed out).

**🔴 Verified defect this corrects:** the sheet computes packaging as
**₹5 × kilograms**, charging ₹50 for a 10 kg bag where the rule says ₹5. This
overstates cost by **₹45 per 10 kg bag on every blend** and therefore
**understates the client's true margins** by:

| Blend | Reported margin | True margin | Δ |
|---|---|---|---|
| Everyday Atta | 41.4% | **46.2%** | +4.74 pts |
| Sugar Care | 43.5% | **47.1%** | +3.60 pts |
| High Protein | 45.9% | **49.2%** | +3.33 pts |
| Thyro Care | 23.9% | **26.7%** | +2.73 pts |
| Vitality Atta | 26.4%* | **29.1%** | +2.73 pts |

\* also affected by the broken SUM in `discovery/FINDINGS.md` §2.
**Good news for the client, and worth telling them.**

---

## ADR-011 · 2026-10-10 · NO returns, no refunds, no RMA
**Problem:** Return policy?
**Decision (client-confirmed):** **No return feature at all.** Nothing
return-related is built.
**Trade-offs — scope saved:** no RMA workflow, no refund ledger, no restock
logic, no return-reason taxonomy, no reverse-logistics states. Roughly a third of
a typical e-commerce order system, removed. Recorded as a non-goal with reason.
**Residual risk accepted:** refused delivery / RTO is *not* a return and is not
covered by a no-return policy — hence `DELIVERY_FAILED` status and the custom-mix
prepayment recommendation in ADR-006.

---

## ADR-012 · 2026-10-10 · Two independent state machines: fulfilment and payment
**Problem:** The brief describes manual status tags and COD. Conflating payment
and fulfilment status is the classic e-commerce bug — with COD an order can be
*delivered* but *unpaid* until the driver hands over cash.
**Decision:** Two orthogonal machines.

**Fulfilment:**
```
PLACED → PREPARING → PREPARED → SHIPPED → DELIVERED → CLOSED
   │                    ▲                      │        (immutable, archived
   └→ CANCELLED         │                      └→ DELIVERY_FAILED / RTO
     (only while        │                          (recorded, never deleted)
      status < PREPARED)└── cancellation lock engages here
```
**Payment:** `UNPAID → AWAITING_VERIFICATION (UPI only) → PAID`
COD orders remain `UNPAID` until delivery, then `PAID`.

Client requirements encoded: cancel permitted **only before `PREPARED`**; **no
customer delivery confirmation** (admin confirms with the driver and sets status);
on `DELIVERED`+confirmation the order becomes **immutable** and moves from the
active queue to records with timestamps for reporting.

**Trade-offs:** Two machines is slightly more code than one `status` column, but
it makes the admin's "Manage payments" page genuinely meaningful — *COD cash still
to collect* vs *UPI awaiting verification* vs *collected*. Every transition is
written to an append-only `order_status_events` timeline, which is what the
customer-facing "track your order" view renders.

---

## ADR-013 · 2026-10-10 · Blend composition rules
**Problem:** What constrains a customer-created mix?
**Decision (client, C5):**
- **Customer mixes: minimum 60% base grain** (`min_base_grain_bps = 6000`,
  admin-configurable per store). The remaining ≤40% is a composition of other
  ingredients.
- **Admin-uploaded premade blends: unrestricted percentages** — they are
  researched formulations (e.g. Thyro-Care uses Kuttu at 40% as its base).
- **Per-ingredient maximum % caps**, admin-set (e.g. seeds ≤15%, psyllium ≤3%).
  Rationale: 40% psyllium husk is inedible and a genuine GI risk. Cheap to build,
  and it protects the brand from a customer harming themselves with a "custom"
  recipe they will blame on the seller.
- Mix total weight must **exactly equal** a valid pack size. Over → prompt to
  remove; under → prompt to add, both expressed as percentages.
- **Proposed UX (awaiting confirmation):** customer builds a *ratio*, then picks a
  target size, and the system **scales ingredient weights proportionally** to hit
  that weight exactly — while enforcing the 60% base-grain floor and per-ingredient
  caps. This satisfies "show what 100% weight looks like" and removes fiddly
  manual arithmetic in kg/grams.

**Trade-offs:** Constraints reduce customer freedom but guarantee the product is
millable, edible and safe. Making them admin-configurable per store means the
rules can tighten without a deploy.

---

## ADR-014 · 2026-10-10 · RBAC: one global ADMIN, store-scoped MANAGERs
**Problem:** Client wants to invite managers per store, each operating
independently with restrictions; one owner-admin holds all data including
customers.
**Decision (client, C6):**

| Capability | ADMIN (owner) | MANAGER (store-scoped) |
|---|---|---|
| Stores visible | **All** | Only assigned store(s) |
| Customer data | **All customers** | Only own store's order customers |
| Update order status | ✅ | ✅ own store |
| Manage inventory | ✅ | ✅ own store |
| **Create/edit products** | ✅ | ✅ **own store** |
| **Edit ingredient rates (incl. cost)** | ✅ | ✅ **own store** |
| **Create/edit coupons** | ✅ | ✅ **own store** |
| **Write blog posts** | ✅ | ✅ |
| View reports | ✅ all stores, incl. margin | ✅ **own store only** |
| Invite / remove staff | ✅ | ❌ |
| Store settings (fees, GST, 60% rule, VPA) | ✅ | ❌ |
| Delete products | ✅ (soft-delete) | ❌ |

Enforced **server-side in middleware**, not by hiding UI. A MANAGER must be unable
to read another store's rows by tampering with a request.

**Trade-offs — risk explicitly accepted by the client:** managers may edit **cost
prices** and **create coupons**. That is a real financial-control exposure: a
manager could raise a cost rate and distort margin reporting, or create a
near-100%-off coupon. Two mitigations adopted: (1) the audit log in ADR-015 makes
every such change attributable and reviewable; (2) **recommended**: cap coupon
discount at a configurable maximum (e.g. 50%) and record `created_by`. Client to
confirm the cap.

---

## ADR-015 · 2026-10-10 · Audit log is mandatory
**Problem:** Client asked to "keep track of what we have changed so that a list
will be provided".
**Decision:** Append-only `audit_log` recording actor, role, store, entity type +
id, action, **before/after JSON**, timestamp, IP. Covers ingredient rates,
product prices, coupons, order status changes, store settings, staff invites,
recipe changes. Admin-viewable and **exportable as a list** (CSV).
**Trade-offs:** Storage growth is linear and small at this scale. Before/after
JSON is schemaless by design — flexible, at the cost of not being queryable per
field. Acceptable: the requirement is *review and export*, not *query*. This
became **mandatory rather than optional** the moment ADR-014 granted managers
cost-editing rights.

---

## ADR-016 · 2026-10-10 · Notifications: Resend email + in-app
**Problem:** How is the admin notified of a new order, and the customer of status
changes?
**Decision (client, C7):** **Resend** for transactional email (direct to the
client's inbox) **plus** an in-app dashboard notification centre.
**Trade-offs:** Resend's free tier (~3,000/month, 100/day) is ample at launch and
costs nothing. Requires a verified sending domain. **Deferred: WhatsApp** — it is
what an Indian small-business owner actually responds to, but the official
WhatsApp Business API charges per conversation and needs Meta approval. A clean
notification-provider seam is built now so WhatsApp can be added later without
touching call sites. In-app alone is insufficient because the admin must be
looking at the site; email alone is insufficient because it can be missed. Both.

---

## ADR-017 · 2026-10-10 · Referral system: free-delivery credits  ✅ RESOLVED
**Problem:** Client requested an invite-coupon system: every new account gets
**first delivery free** and receives a code; when someone signs up with that code
the **referrer earns another free delivery**; repeatable; every user has a code.
**Decision (proposed, pending confirmation):** Model as a **count of
free-delivery credits** on the user account, consumed at checkout, rather than as
issued coupon codes. Credits are simpler, cannot leak or be shared as strings,
and naturally express "and so on". Every user gets a stable, unique,
non-guessable `referral_code`. A `referrals` table records referrer → referee.

**✅ All four decisions resolved by the client, 2026-10-10:**

1. **Award trigger → the referred user's FIRST `DELIVERED` order.** Not on signup.
   Rationale accepted by client: awarding on signup alone is trivially abusable —
   create 50 fake accounts with your own code, collect 50 free deliveries, each a
   real ₹50 driver run. Gating on a delivered order means fake accounts earn
   nothing, and it converts an open-ended liability into a performance-based one.
   `referrals.status` therefore runs `PENDING → CREDITED` on the referee's first
   `DELIVERED` transition, with `credited_order_id` recorded.
2. **Cap → yes.** Referrer credits capped at `referral_credit_cap` (default **10**),
   admin-configurable per store. Bounds total exposure at ~₹500 of driver cost per
   referrer instead of unbounded.
3. **Stacking → a free-delivery credit MAY combine with a discount coupon** (they
   are different types: delivery vs product). Recorded explicitly so it is a
   decision and not an accident. Note the residual risk: a first order that is
   *both* COD (unverified intent) *and* free-delivery is the highest-RTO-risk order
   in the system — the client accepted this.
4. **Referred-user incentive → yes.** A referee who joins **via a code** starts with
   **2** free-delivery credits instead of 1. Without this, a new visitor has no
   reason to enter a code at all, and the loop never starts. This is what actually
   drives sharing.

**Resulting credit lifecycle:**
```
new account (organic)      → 1 credit
new account (via code)     → 2 credits   + creates referrals row (PENDING)
referee's 1st DELIVERED    → referrer +1 credit (capped), row → CREDITED
checkout with credit       → delivery_paise = 0, credits -= 1
```

**Abuse controls adopted:** unique email + phone per account; `UNIQUE(referee_user_id)`
so a user can only ever be referred once; self-referral blocked by CHECK constraint;
credit awarded only on a genuinely delivered order; all referral events appended to
`audit_log`; admin sees pending-vs-credited plus abuse signals (referee never
ordered, repeated same-device signups).

**Trade-offs:** Slightly slower gratification for the referrer (they wait for a
delivery rather than a signup), in exchange for a system that cannot be farmed.
The referee bonus costs the client one extra ₹50 driver run per converted referral
— cheap, and it is the only part of the loop that gives a *stranger* a reason to
participate.

---

## ADR-018 · 2026-10-10 · Non-goals for v1
**Problem:** Scope control for a pre-launch business with a 6-SKU catalog.
**Decision — explicitly NOT built:**

| Non-goal | Reason |
|---|---|
| Returns / RMA / refunds | Client-confirmed (ADR-011) |
| Customer delivery confirmation | Client-confirmed (ADR-012) |
| Product search | 6 products; a filter + category list suffices. Seam left for later |
| Payment gateway, webhooks, idempotency keys for payments | Not needed without a provider (ADR-006) — large scope saving |
| Desktop application | ADR-002 |
| Native mobile app | Deferred; same API (ADR-002) |
| Separate server/database per city | ADR-003 |
| Wholesale / B2B / Meesho ordering | Sheet has wholesale + Meesho price columns — **client to confirm this is offline-only**, else a `customer_type` retrofit is needed later |
| Database-level RLS | Forbidden by ADR-004 dialect constraint; enforced in middleware |
| SMS OTP login | Costs money per message; email + password at launch |
| Delivery slot selection | Admin/driver contacts customer directly |
| PIN-code serviceability validation | City-level store scoping only |

**Trade-offs:** Each removal is reversible *because* the seam is documented here.
Recording non-goals matters as much as recording goals — it prevents re-litigating
them mid-build.

---

## ADR-019 · 2026-10-10 · No Docker in this environment → in-process integration tests
**Problem:** OS mandates Testcontainers and EvoMaster. Verified: no Docker daemon;
1.9 GB RAM; Java 11 present but heap-constrained.
**Decision:** Property-based testing with **fast-check** is the primary adversarial
layer (zero infra cost, and ideal for a pure calculation engine). Integration
tests use in-process libSQL (ADR-004). Full EvoMaster system fuzzing deferred and
re-evaluated at Phase 4 with `-Xmx512m` against a single service.
**Trade-offs:** Loses true database-engine fidelity in tests; gains a test suite
that runs anywhere in seconds. Acceptable because the schema deliberately avoids
Postgres-specific features (ADR-004), which is what would otherwise diverge.

---

## ADR-021 · 2026-10-10 · Pack sizes: 5 kg is custom-mix only
**Problem:** The brief said sizes are 5/10/15/20 kg but that "the 5 kg option is
only for the mixture, not on standard options", while a separate answer said a mix
must total 10/15/20 kg. Direct contradiction.
**Decision (client confirmed):**

| Product type | Available pack sizes |
|---|---|
| **Standard / premade products** | **10 kg, 15 kg, 20 kg** only |
| **Custom mix (Lab)** | **5, 10, 15, 20 kg** |

15 kg and 20 kg remain listed for both even though the client expects low uptake.
`stores.allowed_pack_sizes_g` holds the mix sizes; `product_variants.pack_size_g`
holds standard sizes.

**Trade-offs — commercially noted, client accepted:** the minimum standard order
becomes ~₹950 (10 kg Everyday Atta). For a pre-launch brand with no recognition,
that is a steep first purchase, and the source spreadsheet priced 5 kg standard
bags at ₹275–₹650. The mitigating factor is that the **5 kg custom mix** does
provide a low-cost entry point (~₹400–500) — a new customer can start in the Lab
rather than with a premade 10 kg bag. Recorded so this can be revisited with data
after launch rather than re-litigated now.

---

## ADR-020 · 2026-10-10 · Product names and health copy are content, not code
**Problem:** FSSAI Advertising & Claims Regulations prohibit claims of
prevention/alleviation/treatment/cure of disease, **including implied claims made
through the product name**. "Sugar Care" and "Thyro-Care" sit in that zone.
**Decision:** Product names, taglines and health copy are **admin-editable
database fields, never hardcoded constants or enum values.** A rename is a content
change, not a deploy. Customer-facing nutrition figures are labelled *estimated
from published composition tables*, never as lab-analysed.
**Trade-offs:** Slightly less type safety than an enum of product names — a
deliberate exchange for regulatory flexibility. **BLOCKER-3:** client to confirm
FSSAI licensing status and whether naming advice has been obtained. Raised, not
decided by us.

---

## ADR-022 · 2026-10-10 · Brand tokens are approved and binding for all UI work

**Status:** ✅ RESOLVED (client approved via questionnaire, 2026-10-10)

**Problem:** The client supplied the logo and asked to decide the theme together.
Brand values (authenticity, purity, transparency, health) needed a visual system
that is defensible rather than decorative.

**Decision:** The design system in `07_DESIGN_SYSTEM.md` and `brand-board.html`
is **approved as the heritage-premium direction**. Every token was pixel-sampled
from the supplied logo: ivory surfaces (`#FCFAF5`), antique-gold accent scale
(`#E5D3AB → #B28D60 → #6C4E30`), espresso ink (`#1B1811`), earthy functional
colours; Playfair Display + Manrope + Noto Sans Devanagari; the gold-framed
"certificate" as the Lab's signature. Contrast ratios are measured (WCAG 2.1)
and the measured values — not assumptions — govern which tokens may set small
text. From this point the tokens are **binding**: UI work may not introduce
colours, faces or radii outside the system without a new ADR.

**Consequences:** `brand-board.html` is the visual contract. The Tailwind theme
extension in §7 of the design doc is the implementation contract. Deferred items
remain deferred: no dark-mode variant until launch, logo files live in
`public/brand/`.
