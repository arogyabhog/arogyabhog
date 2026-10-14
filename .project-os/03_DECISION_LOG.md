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
pooled connection string** on the chosen Node host (ADR-023: Netlify). Swap is a `DATABASE_URL` change only.
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

---

## ADR-023 · 2026-10-10 · Deployment is Bundle A: Netlify Starter + Neon Free (₹0/mo)

**Status:** ✅ RESOLVED (client chose Bundle A via questionnaire, 2026-10-10)

**Problem:** The client asked to see hosting alternatives side-by-side before
locking (`08_STACK_COMPARISON.md`). Verification of 2026 free-tier terms
disqualified the obvious choices: Vercel Hobby **bans commercial use**; Supabase
Free **pauses after 7 idle days** (fatal for a pre-launch store); Cloudflare
free caps functions at **10 ms CPU** (cannot hold SSR + a DB round-trip).

**Decision:** **Bundle A.** Next.js (Node functions, not Edge) on **Netlify
Starter** (free, small-commercial permitted: 100 GB egress, 300 build-min,
125 K invocations/mo) + **Neon Free** Postgres (permanent, scale-to-zero,
100 CU-hrs/mo, 0.5 GB, 6 h PITR; nearest free region Singapore) + **Resend**
free tier for email. Auth and payments stay provider-free by prior ADRs.

**Consequences / accepted risks:**
- ~0.5 s DB cold start after idle — acceptable pre-launch; mitigated later by
  keeping a warm ping or moving to a paid compute tier.
- No Mumbai region on Neon Free → Singapore is the nearest; CDN (Netlify edge,
  has Indian PoPs) absorbs static latency. Re-evaluate at launch if TTFB hurts.
- Free-tier policy can change → every piece is portable (Next is host-agnostic,
  Neon is plain Postgres), so **Bundle C (own-a-VPS) remains the documented exit
  path**: a `DATABASE_URL` change plus a deploy target change.
- Netlify function timeout ceiling (~10 s free) is ample for query-backed pages;
  long jobs (report exports) must be chunked or moved to a cron route.

---

## ADR-024 · 2026-10-10 · Data access layer confirmed as Drizzle after comparison

**Status:** ✅ RESOLVED (client confirmed via questionnaire, 2026-10-10)

**Problem:** Drizzle was *assumed* in ADR-004/019 but never compared on the
record. The client asked for the stack to be discussed, so the assumption had
to earn its place.

**Decision:** **Drizzle ORM**, confirmed over Prisma and Kysely:
- Pure TypeScript, **no engine binary** — Prisma's Rust query engine adds memory
  and serverless cold-start weight, which this 1.9 GB sandbox and free-tier
  functions both punish.
- SQL-first schema-as-code: types mirror columns exactly, which is what the
  integer-money discipline (R1) needs — a paise column is a `bigint` mode
  `number`/`bigint` in the type system, not a loose `Decimal`.
- First-class on **both** libSQL (in-process tests, no Docker) and Postgres
  (prod), so the dev→prod swap stays a connection-string change.
- `drizzle-kit` emits readable SQL migrations the CA/auditor can inspect.

Kysely rejected as too much hand-rolled migration/mapping work for ~22 tables;
raw SQL rejected for the same reason at this size.

---

## ADR-025 · 2026-10-11 · One darker accent joins the palette: forest green, used sparingly

**Status:** ✅ RESOLVED (client requested, 2026-10-11: "add a single darker
colour in some places and use it carefully, like the green shade you once showed")

**Problem:** The approved heritage palette (ADR-022) is ivory + gold + espresso.
The client wants one additional darker colour for selective emphasis without
disturbing the approved direction.

**Decision:** Add a **forest** scale, a deep botanical green, as the single
additional accent: `forest-950 #12201A · 900 #1B2E24 · 800 #24402F · 700 #2F523C ·
600 #3F6B4F · 100 #E4EDE5 · 50 #F1F6F1`. It is a darker sibling of the existing
functional `leaf`, promoted from status-colour to brand accent.

**Measured contrast (WCAG 2.1):** ivory on forest-800 **10.89:1 AAA**; ivory on
forest-900 **13.76:1 AAA**; forest-700 text on ivory **8.41:1 AAA**; forest-600
on ivory 5.87:1 AA; **gold-300 on forest-800 7.70:1 AAA** and on forest-900
9.73:1 AAA (gold hairlines and seals may sit on forest bands).

**Careful-use rules (binding):**
1. **At most one forest band per page** — a deep-green narrative strip for
   health/purity/transparency statements (e.g. the IFCT sourcing note, the
   referral explainer). Never a page background.
2. **Never a forest band and an espresso band on the same page** — one dark
   voice per screen.
3. Small-surface uses: purity/organic badges, "in stock", referral-credit chips,
   and the Lab's positive "base-grain minimum met" state (forest-100 on
   forest-800, 9.49:1 AAA).
4. Forest never replaces bronze as the primary CTA, never replaces leaf as the
   success status colour, and never appears in the metallic gradient.

**Consequences:** tokens added to `07_DESIGN_SYSTEM.md` §1/§2/§7 and to
`brand-board.html`. UI work may use forest only per rules 1–4.

---

## ADR-026 · 2026-10-11 · Provisional seed rates unblock the Lab; provenance makes them safe

**Status:** ✅ RESOLVED (client directive, 2026-10-11: "use the ones provided in
the sheet… or we can get data from market. The client can change it when he will
get the website.")

**Problem:** ADR-008 requires admin-set selling rates, but the client is
unreachable and the sheet contains **no per-ingredient selling rates at all** —
only costs and blend-level selling figures. The Lab cannot build against empty
rates (R1.3 hard-fails on missing rates by design).

**Decision:** Seed all 18 rows provisionally per the rule in
`discovery/SEED_RATES.md`: sheet costs verbatim; selling = cost × the home
blend's own markup (MRP ÷ corrected raw cost), rounded to ₹5; a market guard
overrides any derived sell above 1.8× a cited 2026 retail band (applied once:
pumpkin seeds 1700 → 900); methi (absent from the sheet) is market-seeded.
Provenance columns `cost_source`, `sell_source`, `rates_provisional` on
`ingredients`; admin edits flip provenance to `client` and clear the flag,
audit-logged (ADR-015).

**Product behaviour while provisional:** the Lab shows an "indicative pricing"
chip; the Price Consistency Checker treats provisional rows as warnings, not
errors. The flagged rows (pumpkin cost above retail, sunflower, sesame, methi,
Vitality-anchor rows) form the client's guided first-review list.

**Consequences:** BLOCKER-1 downgrades from "client data-entry dependency" to
"client review of provisional seeds". No derived rate ever ships unflagged; the
client's hand-set rates remain the only non-provisional source.

## ADR-027 · 2026-10-12 · Orders are two state machines over a frozen money snapshot

**Status:** ✅ RESOLVED (implements ADR-011/012/015/017 hook points)

**Problem:** Checkout needs order lifecycle, COD + providerless UPI-QR payment
tracking, delivery-credit redemption, and an exportable audit trail — with no
auth layer yet, and money that must never drift after placement (rates are
admin-editable per ADR-008/026).

**Decision:**
1. **Frozen snapshot.** At creation, all money is computed once (Lab orders via
   the verified mix engine; premade via `variant.sellPaise`, which is already
   the all-inclusive GST-inclusive shelf price → milling/packaging = 0) and
   stored in `orders.items_snapshot` + money columns. Later rate edits never
   touch placed orders.
2. **Fulfilment machine** (closed union, transition table in
   `src/domain/order-engine.ts`): PLACED→{PREPARING,CANCELLED};
   PREPARING→{PREPARED,CANCELLED}; PREPARED→SHIPPED;
   SHIPPED→{DELIVERED,DELIVERY_FAILED}; DELIVERY_FAILED→{SHIPPED,RTO};
   DELIVERED→CLOSED; RTO→CLOSED; CLOSED and CANCELLED terminal and immutable.
   Cancellation window is therefore exactly PLACED/PREPARING (spec: pre-PREPARED).
3. **Payment machine:** UNPAID→{AWAITING_VERIFICATION,PAID};
   AWAITING_VERIFICATION→{PAID,UNPAID} (admin rejects an unverifiable UPI
   claim → back to UNPAID, never a refund object — no-refund scope stands);
   PAID terminal. COD confirms at delivery with the driver; UPI_QR is
   customer-attested ("I have paid") then admin-reconciled against the bank
   statement. No gateway, no webhook — there is no provider to call.
4. **Cross-machine rule:** DELIVERED→CLOSED requires paymentStatus=PAID
   (CLOSED is the immutable archive; we never archive money ambiguity).
   RTO→CLOSED does NOT require PAID (goods came back; COD never moved money;
   any prepaid UPI+RTO case gets a mandatory event note for manual policy).
5. **Delivery credits (ADR-017 economics):** redemption is opt-in at creation,
   consumes exactly one credit, waives the ₹50 fee (snapshot keeps
   `deliveryFeePaise` quoted AND `deliveryPaise` charged). Cancellation
   refunds the credit. Referral *awarding* (referee bonus, referrer +1 on
   first DELIVERED, cap 10) stays in its own slice — the DELIVERED transition
   is the documented hook point.
6. **Premade invoice honesty:** a premade snapshot carries ONE money line
   (the pouch at its shelf price, 100.00%). We refuse to pro-rate per-ingredient
   prices for a fixed-price blend — that would fabricate numbers the client
   never set. Exact composition % lives on the PDP, not in fake price lines.
7. **GST on premade** is re-derived from the inclusive price with the engine's
   own formula (`roundHalfUp(sub×bps, 10000+bps)`, CGST floor-half, SGST
   remainder) so every invoice shows the statutory split, HSN 11010000.
8. **Audit:** every create/transition/payment change appends to `order_events`
   (actor nullable = customer self-service), exportable as a list (ADR-015).
9. **No API routes in this slice.** Unauthenticated order/admin endpoints would
   violate ADR-014 (server-side RBAC) worse than no endpoints. The service
   takes explicit `actorId`; routes land with the auth slice.

**Consequences:** orders + order_events tables and migration 0001; domain
module with full transition-matrix tests; `OrderError` closed union mirroring
`MixErrorCode` discipline. Checkout UI and admin console consume this service
once auth exists.

## ADR-028 · 2026-10-12 · Forest green is promoted from single accent to structural accent

**Status:** ✅ RESOLVED (client directive, 2026-10-12: "that green color make it
more use because almost all the re[s t] is filled with light color we can add
then in background and components. not too much but more then what we have now.")

**Amends:** ADR-025 (which reserved forest to one careful moment per page).

**Decision:** Forest keeps its discipline but gains structural roles:
1. **Dark bands:** promise strip and footer move to forest-950; the Lab CTA
   band stays forest-900. At most one dark band per viewport.
2. **Table headers:** composition + nutrition tables on PDPs get forest-900
   headers with gold-200 text (heritage-premium, matches the logo's deep green).
3. **Interactive states:** selected pack pill, active template chip, focus
   rings, range-slider accent, and primary CTAs (hero "Build my atta", PDP
   "Order") are forest; hover borders on product cards are forest-600.
4. **Tints:** benefit panel and nutrient group rows use forest-50/100 washes.
5. **Gold's job is unchanged:** money, prices, rules, and the certificate
   frame stay gold — green is for structure and action, gold is for value.
6. **Never** forest for body copy on light backgrounds; forest-700/800 only
   for small bold labels/eyebrows.

**Consequences:** layout, home, shop, PDP and LabClient updated in place;
design-system doc (07) to be refreshed with the new usage table next time it
is opened. Reversal cost is one commit (token-level classes only).

## ADR-029 — Product families: locked premades, single-grain flours, custom Lab mixes
**Status:** Accepted 2026-10-12 · **Supersedes:** part of ADR-013 (Lab templates)
**Context:** Client directive: the five house mixes must not be editable by customers; single-grain flours (wheat atta, jau, …) sold in the market should also be products; home shows six best-sellers mixing both kinds; shop lists singles first then mixes; the Lab keeps a "mix your own" mode. Loading locked recipes into the guardrailed composer also surfaced rule conflicts (Thyro-Care is wheat-free, Sugar-Care/Vitality sit under the 60% base-grain floor), which read as "calculation problems".
**Decision:** `products.kind` ∈ {premade, single}. Premades and singles are quantity-only purchases (pack picker on PDP; premade packs 10/15/20 kg priced linearly off the sheet 10 kg rate, singles 1/5/10 kg off provisional per-kg ingredient rates). The Lab composer starts EMPTY and never loads a house recipe; house mixes appear above it as locked "order as-is" cards linking to their PDPs. PDP nutrition discloses per 100 g + per 1 kg (pack-size independent). Shop order: singles section, then blends. Home: six curated best-sellers across kinds.
**Consequences:** rule-violating templates can no longer enter the composer (bug class closed); admin re-pricing per pack stays possible later; `?template=` param retired.

## ADR-030 — Third nutrition source tier: other national composition tables
**Status:** Accepted 2026-10-12 · **Amends:** ADR-007
**Context:** Psyllium (RM-011) had no IFCT row usable without conflict (secondary IFCT mirrors disagree: 189 vs 350 kcal) and USDA offered Branded-only items with corrupt iron — so it stayed "nutrition pending", blocking Lab mixing and forcing coverage disclosures on High-Protein/Vitality.
**Decision:** When IFCT 2017 and USDA both fail, a full profile from another national food-composition table may be seeded, one source per nutrient row (ADR-007 discipline unchanged). Psyllium seeded from Frida NO (Matvaretabellen food 05.465, Plantago ovata, values via Livsmedelsverket SE DB 2021.05): 206 kcal, protein 1.2 g, fat 0.5 g, carbs 10 g, fibre 78 g, Ca 184 mg, Fe 8.6 mg, Zn 0.3 mg, Mg 24 mg, P 41 mg, K 965 mg, Na 74 mg, B1 40 µg, B2 0, B3 0.4 mg, folate 58 µg (18/18 codes). `NutrientSource` gains 'Frida NO'; artefact `discovery/frida-national-table-nutrients.json`.
**Consequences:** psyllium is mixable in the Lab; coverage disclosures on High-Protein (98.0%) and Vitality (99.0%) retire; provenance remains per-row and displayed. Client lab analysis, when available, overrides via the CLIENT tier.

## ADR-029 amendment — pack sizes: 5 kg is Lab-only
**Status:** Accepted 2026-10-13. Client rule: the minimum 5 kg pack exists ONLY for custom mixes. All boxed products (premade blends AND single-grain flours) sell 10/15/20 kg. Seed + ProductCard + PackPicker updated; singles re-priced linearly off provisional per-kg rates.

## ADR-031 — Staff authentication: scrypt + opaque cookie sessions, RBAC per route tree
**Status:** Accepted 2026-10-13 · **Implements:** ADR-014/015
**Context:** The auth slice unlocks checkout UI, admin console and referral awarding. No external provider (client pays no gateway; same discipline for identity).
**Decision:** Passwords hashed with scrypt (N=16384, per-user salt, timing-safe compare; format `scrypt$salt$hash`). Sessions = opaque 256-bit tokens in an httpOnly, sameSite=lax cookie (secure in production), 30-day expiry, stored in a `sessions` table (revocable, no JWT). Every `/admin/*` request re-reads the session server-side in the layout; customers and anonymous visitors redirect to `/login`. Roles enforced where data is touched: ADMIN global, MANAGER store-scoped (console header shows the scope). Audit (ADR-015) writes on auth.login, auth.login_failed, auth.logout, audit.export; `/admin/audit/export.csv` streams the full list as RFC-4180 CSV behind the same gate. Dev-only credentials are hashed at seed time (env-overridable), never stored in git, and printed on /login only in development.
**Consequences:** checkout and admin edits can now attribute actors; session revocation = row delete; migrating to Postgres needs no change (plain table + cookie).

## ADR-032 — Checkout mechanism: customer accounts, client-side basket, one order per line, providerless UPI QR
**Status:** Accepted 2026-10-13 · **Implements:** ADR-014/015/019/027 · **Depends on:** ADR-031
**Context:** The storefront could show prices but not take money. Constraints: no payment gateway ever (client keeps 100% of UPI); COD stays available; referrals (ADR-019) need an account to credit; the order engine (ADR-027) already freezes money at creation, so checkout must be a thin, audited adapter over `createPremadeOrder`.
**Decision:**
1. **Customer accounts** reuse the staff auth stack: `/register` creates a CUSTOMER user (scrypt hash), auto-signs-in, stores optional referral code → `referredByCode` + 2 free-delivery credits (vs 1 without), audit `auth.register`. Login honours a safe `next` param (same-origin paths only) so `/checkout` bounces guests to `/login?next=/checkout` and returns them after sign-in.
2. **Basket lives in localStorage** (`ab_cart_v1`, lines `{slug, packG, qty}`) with an `ab-cart-change` event; the header CartButton and PDP "Add to cart" are client components. No cart table pre-launch — carts are disposable, orders are the durable fact. PackPicker offers exactly the ADR-029-amendment packs (10/15/20 for boxed products).
3. **One order per cart line.** Checkout serialises the basket into a hidden field; the server action re-reads each product from the DB (never trusts client prices), validates contact (phone ≥10, address ≥8, pincode), then calls `createPremadeOrder` per line with `storeId = SEED_STORE_ID`. Single line → redirect to its order page; multi → `/orders`. Success redirect carries `?placed=1`; a client `CartClearer` empties localStorage on arrival (server actions cannot touch it).
4. **Payment choice at checkout:** COD (pay driver) or UPI QR. UPI QR is providerless: the order page renders a QR of `upi://pay?pa=<store.upiVpa>&pn=ArogyaBhog&am=<rupees>&cu=INR&tn=<orderId>` (new `stores.upiVpa` column, migration 0004, seeded `arogyabhog@upi` placeholder until the client's real VPA lands). Customer taps "I have paid" → `markPayment(→AWAITING_VERIFICATION)` (engine writes order_events + audit itself); admin reconciliation to PAID is the next slice.
5. **Order pages are RBAC-gated:** `/orders` and `/orders/[id]` show only the owner's orders (staff see any); detail = receipt breakdown (raw/milling/packaging/GST split/delivery/total), timeline from `listOrderEvents`, QR or COD note, attest form. Audit `order.placed` per order.
**Consequences:** money flows without a gateway (fee = 0); attestation is a claim, not proof — PAID stays admin-verified against the bank statement (QR block says so explicitly); multi-line carts create sibling orders that fulfil independently (simplest correct model for the engine); cart loss on device change is acceptable pre-launch; referral awarding on first DELIVERED still pending (needs fulfilment UI).

## ADR-033 — Admin catalog editing boundaries
**Status:** Accepted 2026-10-11 · **Implements:** ADR-008/020/026/029
**Context:** Staff need to manage each seeded product, its individual pack prices, copy/status, and premade blend ratios. The implemented schema is narrower than the target schema in `04_DATABASE_SCHEMA.md`.
**Decision:** The v1 editor mutates only fields present in Drizzle: product name/description/status, existing variant cost/sell/active, and existing premade recipe ratios. Decimal rupee input is parsed as integer paise; a staff price edit clears the provisional flag and sets sell provenance to `client`. Recipe ratios are positive integers summing exactly 10,000 bps; this screen cannot add/remove ingredients. Slugs are immutable in v1 to avoid breaking storefront URLs. Inactive products and variants are hidden from storefront queries and rejected by the order service. Every mutation includes before/after audit data and is store-scoped for MANAGER.
**Trade-offs:** Narrow editor avoids partial recipes, floating-point money, stale URLs, and a schema migration in the first catalog pass. New SKU creation, product imagery/SEO, inventory/stock, and append-only ingredient price history require explicit schema/data design before UI work.

## ADR-034 — Ingredient rate history and premade price consistency
**Status:** Implemented on `feat/admin-ingredient-pricing` (2026-10-12), pending branch verification/review.
**Context:** ADR-008 requires client-entered ingredient selling rates and a mandatory checker, while the initial Drizzle schema retained only the current ingredient rates and could not explain their provenance over time.
**Decision:** Add append-only `ingredient_price_history` snapshots and a per-store `price_consistency_tolerance_bps` (default 500 bps / 5%). Admin rate updates parse/validate integer paise, are store-scoped and transactional, clear provisional status, set source to `client`, write before/after audit data, and append a history row. Existing rates are backfilled by migration 0005; seed creates baseline snapshots. Premade checker rebuilds ingredient + milling + packaging + GST-inclusive pricing and compares it with shelf price; order-level delivery is excluded. Provisional rates always require review; otherwise flag variance over store tolerance.
**Consequences:** Rate changes remain explainable and auditable without rewriting prior snapshots. Store-specific tolerance is configurable. Dashboard exposes provisional-rate workload. No automatic product repricing is performed.

### ADR-031 implementation note — cross-site embedded preview sessions (2026-10-12)
Arena serves the workspace app inside a cross-site iframe. Browser `SameSite=Lax`
prevents the staff session cookie from being sent back in that embedded preview,
so a successful sign-in appeared to fall back to `/login` or the storefront. For
the explicitly opted-in `ARENA_EMBEDDED_PREVIEW=1` preview process only, set the
session cookie `SameSite=None; Secure`; production/default remains `Lax`. Admin
access still requires an ADMIN or MANAGER account. Preview login displays the
seed-only staff credentials; never enable this flag or seed credentials in a
real deployment.

## ADR-037 — Admin store settings stay within existing store schema
**Status:** Implemented on `feat/admin-store-settings` (2026-10-14).
**Context:** Operators need per-store control of fees, tax, mix constraints, referral policy and price-check tolerance. The full planning schema mentions fields not present in the shipped v1 `stores` table (notably GSTIN and UPI payee/MCC).
**Decision:** Expose only persisted v1 fields: name/city, UPI VPA, delivery/packaging/milling fees, GST bps, allowed Lab pack sizes, minimum base-grain bps, referral cap/bonus, and price-check tolerance. ADMIN selects a store; MANAGER is restricted to their assigned store. Validate paise as integer rupee conversions, basis points/credit counts as bounded integers, and pack sizes from the established mix-size set. Save + before/after audit atomically, with an `updated_at` optimistic-concurrency check. Do not add guessed GSTIN/payee/MCC fields or change store activation status without an explicit data/workflow requirement.
**Consequences:** No schema migration. Existing order snapshots remain immutable; changed store defaults apply to subsequent calculations/orders. Store scope is enforced in the action, not trusted from the selector.

## ADR-038 — Raw-material inventory is an append-only movement ledger
**Status:** Implemented on `feat/admin-inventory` (2026-10-14), pending commit/push.
**Context:** The planning schema specifies raw ingredient tracking (C6) and prohibits a mutable on-hand counter. Orders use frozen snapshots and can be cancelled before preparation.
**Decision:** Add `inventory_movements` with integer signed grams, store/ingredient, reason, optional order/note/actor/time, FK/check constraints and aggregate/history indexes. Derive stock exclusively as the movement sum. Do not backfill or assume opening balances; operators enter a verified count as an adjustment. Show negative stock as a reconciliation warning but do not block checkout until physical opening counts are verified. Freeze ingredient IDs + total grams in new order snapshots. On placement, append one negative reservation per ingredient inside the order/event transaction; for eligible cancellation append matching positive returns in the same transaction, and condition the cancellation update on the prior state to prevent duplicate release. Premade shares use deterministic largest-remainder allocation so integer grams sum to the exact pack weight.
**Consequences:** New `/admin/inventory` gives scoped balances/history and audited purchase, wastage, and signed adjustment forms. Legacy orders remain outside the ledger; no invented physical count or historical consumption. Down migration is intentionally destructive and documented.

## ADR-039 — Store-scoped coupons and immutable order redemptions
**Status:** Implemented and verified on `feat/admin-coupons` (2026-10-15); local commit `a2e3fbd`; push pending remote configuration.
**Implements:** ADR-014, ADR-015, ADR-027, ADR-032.

**Context:** Admins need per-store offers without rewriting past orders or trusting a browser-submitted coupon result. The checkout engine creates one sibling order per cart line, and item prices are GST-inclusive.

**Decision:**
1. Persist `coupons` per store with normalized unique code, type (`PERCENT`, `FLAT`, `FREE_DELIVERY`), value, minimum item subtotal, optional cap, usage limits, dates, active flag, creator, and creation time. Store isolation is checked server-side in admin actions and checkout.
2. Use integer paise only. Percent values are basis points; flat values and all caps are paise. Manager-created percent offers are capped at 5,000 bps (50%); manager flat value and per-order cap are limited to ₹50. ADMIN is the owner-controlled exception. These are conservative defaults for the risk left open in ADR-014.
3. Item coupons reduce the GST-inclusive item subtotal, then GST is recomputed on that discounted subtotal. Free-delivery offers waive only the quoted delivery fee; they do not change item subtotal or GST.
4. Freeze code/type/discount in both order coupon columns and the immutable `items_snapshot`. Append one `coupon_redemptions` row per coupon/order. The redemption row is never removed; usage counts exclude orders whose fulfillment status is `CANCELLED`. Coupon terms are editable only while there are no non-cancelled redemptions; deactivation remains available at any time.
5. Checkout re-reads coupon/product/variant/store values server-side. Eligibility and usage capacity are checked for all cart lines before creating orders and rechecked transactionally for each order. Each sibling order consumes one usage, and per-user limits count per order. UI disclosure explains this behavior.
6. Referral delivery-credit stacking with coupons is not implemented in this slice (despite the broader stacking possibility in ADR-017); the checkout does not offer a combined redemption.
7. Create, edit, activate, and deactivate actions write before/after audit rows in their transaction. Managers can affect only their assigned store; admins may select any store.

**Consequences:** Migration `0007_moaning_wild_pack.sql` adds coupons, redemptions, and nullable order coupon snapshots without rebuilding legacy orders. The destructive down migration removes all coupon definitions, redemption history, and order coupon fields. Migration application/rollback must be verified before release. Coupon records are retained, never hard-deleted.
