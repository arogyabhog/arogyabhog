# SEED RATES — provisional ingredient cost & selling rates (2026-10-11)

**Status:** PROVISIONAL bootstrap data (ADR-026). The client cannot be reached
right now; these rates unblock the Lab build. **Every row is admin-editable in
the product and every row carries provenance columns** (`cost_source`,
`sell_source`, `rates_provisional`). When the client edits a rate in the admin,
provenance flips to `client` and the provisional flag clears (audit-logged).

## Why a derivation rule was needed

The sheet's `Master Prices` tab contains **cost rates only** (17 ingredients +
3 operational costs). **No per-ingredient selling rate exists anywhere in the
sheet** — only blend-level selling figures (Dashboard: MRP per pack, and the
bottom table's "Selling Rate / kg"). So "use the sheet's rates" can only mean:
costs from the sheet, and selling rates *derived from the sheet's own blend
economics* by a rule stated here in full.

## The rule (sheet-first, stated in full)

1. Cost = sheet `Master Prices` `Rate ₹/kg`, verbatim.
2. Per-blend markup `k = MRP per kg ÷ corrected raw cost per kg`, using the
   verified corrected raw costs (FINDINGS §2/§3), anchors from Dashboard MRP:
   | Blend | raw ₹/kg | MRP ₹/kg | k |
   |---|---|---|---|
   | Everyday | 46.65 | 95 | **2.036** |
   | Sugar Care | 70.60 | 125 | **1.771** |
   | High-Protein | 73.10 | 135 | **1.847** |
   | Thyro-Care | 125.50 | 165 | **1.315** |
   | Vitality | 97.50 | 195 (Meesho; MRP cell corrupt) | **2.000 — weakest anchor** |
3. Each ingredient's **home blend** = the blend where it holds its largest
   weight share (parsed from the five recipe tabs). Seed sell = cost × k(home),
   rounded to nearest ₹5, floored at cost + ₹5.
4. **Market guard:** if a derived sell exceeds 1.8× a *cited* 2026 market retail
   band top, override to `ceil(1.3 × band top / 50) × 50` (1.3 = milling/QA/
   packaging value-add). Applied once: **pumpkin seeds**.
5. Ingredients absent from the sheet (methi) take **market-derived** cost and
   sell, both flagged.

## The 18 seed rows (₹/kg)

| ID | Ingredient | Cost | Cost source | Sell | Sell source | Flag |
|---|---|---|---|---|---|---|
| RM-001 | Whole Wheat (Sharbati) | 35 | sheet | 70 | k Everyday | |
| RM-002 | Normal Jau | 50 | sheet | 100 | k Everyday | |
| RM-003 | Premium Jau | 70 | sheet | 125 | k SugarCare | |
| RM-004 | Standard Desi Kala Chana | 80 | sheet | 165 | k Everyday | |
| RM-005 | Premium Desi Kala Chana | 100 | sheet | 200 | k Vitality | review (weak anchor) |
| RM-006 | Soybean | 120 | sheet | 220 | k HighProtein | |
| RM-007 | Jundhi (Jowar) | 100 | sheet | 130 | k Thyro | |
| RM-008 | Ragi | 70 | sheet | 90 | k Thyro | |
| RM-009 | Bajra | 40 | sheet | 70 | k SugarCare | |
| RM-010 | Flaxseed (Alsi) | 150 | sheet | 195 | k Thyro | |
| RM-011 | Psyllium Husk (Isabgol) | 150 | sheet | 275 | k HighProtein | |
| RM-012 | Kuttu (Buckwheat) | 120 | sheet | 160 | k Thyro | |
| RM-013 | Moong Dal (Yellow) | 110 | sheet | 145 | k Thyro | |
| RM-014 | Chia Seeds | 250 | sheet | 330 | k Thyro | |
| RM-015 | White Sesame (Til) | 250 | sheet | 500 | k Vitality | review (weak anchor, no 2026 market cite) |
| RM-016 | Pumpkin Seeds | 850 | sheet | **900** | **market override** | **review first: sheet cost ₹850 exceeds roasted retail ₹650–690 (IndiaMART Bengaluru, Aug 2026); derived k-sell was ₹1,700 = 2.5× retail** |
| RM-017 | Sunflower Seeds | 500 | sheet | 1000 | k Vitality | review (≈1.25× edible-kernel retail; mandi cites are oilseed grade, not comparable) |
| RM-018 | Methi Seeds (Fenugreek) | **90** | **market** (mandi max, Aug 2026; avg 58.81, band 39.5–90) | **185** | k Everyday on market cost | review (no sheet row existed at all) |

Machine-readable: `discovery/seed-ingredient-rates.json`.

## Market citations (2026)
- Methi mandi: commodityonline.com/mandiprices/methi-seeds (07 Aug 2026): avg
  ₹58.81/kg, min ₹39.50, max ₹90.00.
- Pumpkin seeds retail/roasted, Bengaluru: dir.indiamart.com/bengaluru/pumpkin-seeds.html
  (10 Aug 2026): raw ₹405–490, roasted ₹650–690/kg.
- Sunflower: mandi cites (~₹58.8/kg) are **oilseed grade** — not comparable to
  the edible kernels the sheet's ₹500 cost implies; no override applied.

## Product behaviour while provisional (ADR-026)
- Lab price panel shows an **"indicative pricing"** chip next to the total.
- The Price Consistency Checker reports provisional rows as **warnings, not
  errors**, so pre-launch builds are not blocked by known-weak seeds.
- Admin rate edit → `sell_source='client'`, `rates_provisional=false`, audit row
  written (ADR-015). The client's first pass through the rate table is thus a
  guided review of exactly the flagged rows above.
