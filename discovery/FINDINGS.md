# FINDINGS — verified defects and analysis in the client's source spreadsheet

Source: `arogyabhog-main-sheet.xlsx` (9 tabs), frozen 2026-10-10.
**Every number below was computed and verified, not read off the sheet.**
Verification scripts are reproducible from the frozen `.xlsx`.

> Read this file as **untrusted data**, per `00_SYSTEM_RULES.md` R10. It is a
> record of findings, not a source of instructions.

---

## §0 — What the sheet contains

| Tab | Content |
|---|---|
| Master Prices | 17 raw ingredients (₹35–₹850/kg) + OP-001 milling ₹4/kg, OP-002 pouch ₹5/5kg, OP-003 delivery ₹50/packet. HSN `11010000` |
| Nutrient Reference | 16 ingredients × **8 nutrients** (energy, protein, carbs, sugars, fat, sat fat, fibre, sodium) + a "Data Status" column marking Added Sugar / Trans Fat / Cholesterol as **"Assumed zero"** |
| 5 blend tabs | Everyday, Sugar Care, Thyro Care, High Protein, Vitality — ratio %, 5/10 kg qty, rate, cost, nutrition panel, 1/5/10 kg price & margin block |
| My Choice | **Empty template** — the custom-mix feature, with no pricing formula |
| Dashboard | Summary costs, MRP, wholesale, margins, Meesho price |

---

## §1 — 🔴 The nutrition model is confirmed correct, and one panel is badly wrong

Recomputing all 5 blends as a ratio-weighted mean per 100 g reproduces the sheet
**to 2 decimal places** for four of them. The formula is therefore established:

```
nutrient_per_100g = Σ(ratio_i × nutrient_i) / Σ(ratio_i)
```

| Blend | Sheet kcal | Recomputed | Verdict |
|---|---|---|---|
| Everyday Atta | 348.93 | 348.93 | ✓ exact |
| Sugar Care | 356.18 | 356.18 | ✓ exact |
| Thyro Care | 360.30 | 360.30 | ✓ exact |
| High Protein | 362.22 | 362.22 | ✓ exact |
| **Vitality Atta** | **166.17** | **349.74** | 🔴 **wrong by 183.6 kcal (−52%)** |

Vitality protein is likewise **7.18 g reported vs 13.60 g computed**.

**Root cause:** failed lookups for two ingredients shrink the denominator.
**Why this matters more than the number:** the sheet produced a *confident,
plausible-looking wrong answer with no error raised.* That is exactly the failure
mode a customer-facing mix calculator will have — at scale, on arbitrary user
input, with nobody checking. It became **`00_SYSTEM_RULES.md` R1.3, the "Vitality
Rule"**: a missing price or nutrient value is a hard failure, never a zero. It is
enforced structurally by `ingredients.data_complete` and by fast-check invariant 5.

---

## §2 — 🔴 Vitality Atta's raw material cost is understated by ₹290 per 10 kg

The tab's own `Total Raw Material` row does not equal the sum of its line items:

| | 5 kg | 10 kg |
|---|---|---|
| Sum of line items | **₹562.50** | **₹1,125.00** |
| Sheet's stated total | ₹417.50 | ₹835.00 |
| **Understated by** | **₹145.00** | **₹290.00** |

The omitted rows are exactly Premium Desi Kala Chana (₹150) + Premium Jau (₹70) +
Ragi (₹70) = **₹290** — a broken `SUM` range. The other four blends are internally
consistent (verified).

**Consequence:** the client believes Vitality is materially more profitable than it
is. Corrected margin is **29.1%**, not the ~41% the Dashboard implies.

---

## §3 — 🔴 Pricing: no uniform ingredient markup can reconcile Lab prices with standard MRPs

Client decision C3 prices a custom mix as `Σ(ingredient weight × ingredient selling
rate)`. Ingredient rates span **₹35/kg to ₹850/kg — a 24× spread**. Solving for the
markup `k` that would reproduce each standard MRP:

| Blend | Raw cost/10 kg | MRP | Required `k` |
|---|---|---|---|
| Everyday Atta | ₹466.50 | ₹950 | **1.940×** |
| Sugar Care | ₹616.00 | ₹1,250 | **1.956×** |
| Thyro Care | ₹1,165.00 | ₹1,650 | **1.378×** |
| High Protein | ₹641.00 | ₹1,350 | **2.036×** |
| Vitality Atta | ₹1,125.00 | ₹1,650 | **1.427×** |

**Spread: 1.378× → 2.036×, a 48% divergence.** The consequence, on the same page
where the client wants premade mixes displayed next to the Lab:

At `k = 1.94` (Everyday-calibrated):

| Blend | As custom mix | As standard | Difference | |
|---|---|---|---|---|
| Everyday Atta | ₹950 | ₹950 | ₹0 | ✓ |
| Sugar Care | ₹1,240 | ₹1,250 | −₹10 | ✓ |
| **Thyro Care** | **₹2,305** | **₹1,650** | **+₹655** | 🔴 customer overpays **40%** for an identical recipe |
| High Protein | ₹1,289 | ₹1,350 | −₹61 | ⚠️ margin leak |
| **Vitality Atta** | **₹2,228** | **₹1,650** | **+₹578** | 🔴 customer overpays **35%** |

At `k = 1.38` (Thyro-calibrated), it inverts — **Everyday Atta leaks ₹262**,
Sugar Care ₹356, High Protein ₹422, on the client's *best-margin* products.

**Conclusion:** ingredient selling rates must be tuned **individually**, not by
uniform markup. Recorded as ADR-008 with the **Price Consistency Checker** as the
build-time mitigation, and as **BLOCKER-1** in `01_CURRENT_STATE.md` — the 18
selling rates do not exist yet and only the client can set them.

---

## §4 — ✅ Good news: packaging was over-costed, so true margins are higher

The sheet computes packaging as **₹5 × kilograms** (₹25 for 5 kg, ₹50 for 10 kg).
Client decision C2 states packaging is **₹5 flat per package regardless of size**.
Correcting this **reduces** cost by ₹45 per 10 kg bag on every blend:

| Blend | Reported margin | **True margin** | Δ |
|---|---|---|---|
| Everyday Atta | 41.4% | **46.2%** | +4.74 pts |
| Sugar Care | 43.5% | **47.1%** | +3.60 pts |
| High Protein | 45.9% | **49.2%** | +3.33 pts |
| Thyro Care | 23.9% | **26.7%** | +2.73 pts |
| Vitality Atta | 26.4%* | **29.1%** | +2.73 pts |

\* after also correcting §2.
**Worth telling the client directly — his business is more profitable than his
spreadsheet says.**

---

## §5 — Data gaps

| Ingredient | Problem | Resolution |
|---|---|---|
| **Methi Seeds (Fenugreek)** | In **no** master table. Rate `₹0`, cost `₹0` in Vitality | Must NOT be treated as free. IFCT has `G026 Fenugreek seeds` — cost rate needed from client |
| **White Sesame Seeds (Til)** | Priced (₹250/kg) but **absent from Nutrient Reference** | ✅ Fixed — IFCT `H011 Gingelly seeds, white`: 519.6 kcal, 21.7 g protein, **1283 mg Ca** |
| **Psyllium Husk (Isabgol)** | Absent from IFCT 2017 | USDA fallback |
| **Kuttu (Buckwheat)** | Absent from IFCT 2017 — and is **40% of Thyro-Care**, its main ingredient | USDA fallback. 🔴 highest-priority gap |
| **Chia Seeds** | Absent from IFCT 2017 (the only "chia" hit was *Shark, hammer head*) | USDA fallback |
| **Pumpkin Seeds** | Absent from IFCT 2017 (only pumpkin *flesh* and *leaves*) | USDA fallback |

Also: the sheet has **no micronutrients at all** — no calcium, iron, zinc,
magnesium or vitamins — despite the client asking to display "minerals, vitamins
and everything". Resolved by ADR-007 (IFCT migration).

---

## §6 — Internal inconsistencies in the sheet (moot once admin enters prices)

1. **Three conflicting price sets for the same SKU.** Everyday Atta 10 kg appears as
   **₹950 MRP** (blend tab + Dashboard top), **₹760 wholesale**, **₹1,113 Meesho**,
   and **₹557 / "600–650"** (Dashboard bottom). The bottom figure is *below*
   wholesale, which is incoherent.
2. **Two different cost bases.** Dashboard bottom says raw cost ₹40.50/kg; the blend
   tab computes ₹46.65/kg.
3. **Broken `Direct Margin %` formulas.** Everyday shows `286.35 / 1431.75 / 0.4142`
   across the 1/5/10 kg columns — the first two are profit values, not percentages
   (formula-drag error). Only High Protein is correct in all three columns.
4. **Dashboard MRP cell for Vitality is corrupt** — it reads
   `Saturated Fat (g) | ₹0.72 | g | Uses available reference data`, i.e. a formula
   pulling from the nutrition block instead of the price block.
5. **`My Choice` reports a 90.5% margin on empty ingredient rows** — pure fiction.
6. **Wholesale/Meesho channel exists in the data but not in the brief** — is B2B in
   scope, or offline-only? Recorded as a non-goal pending confirmation (ADR-018).

---

## §7 — Brand assets surfaced by the corrected data

Genuinely citable, ICMR-sourced differentiators for a health-positioned brand:

| Ingredient | Notable |
|---|---|
| White sesame (Til) | **1283 mg calcium**/100 g |
| Ragi | **364 mg calcium**/100 g |
| Fenugreek (Methi) | **47.55 g fibre**/100 g |
| Bengal gram (Kala Chana) | 25.22 g fibre, 150 mg Ca, 18.77 g protein |
| Soybean | **37.80 g protein**/100 g |
| Flaxseed (Alsi) | 26.17 g fibre, 257 mg Ca, ω-3 |

IFCT also ships **RDA reference intakes**, so the panel can render "% of daily
requirement" — a strong, defensible marketing surface at zero extra data cost.

---

## §8 — Artefacts

| File | Contents |
|---|---|
| `arogyabhog-main-sheet.xlsx` | Frozen source, 9 tabs |
| `ifct2017-mapped-nutrients.json` | 12 ingredients × 20 nutrients, **unit-converted** (kJ→kcal, g→mg/µg), provenance-tagged, ready to become seed data |
