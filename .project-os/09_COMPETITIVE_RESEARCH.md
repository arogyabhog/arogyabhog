# 09 — COMPETITIVE & UX RESEARCH (2026-10-11)

Purpose: learn from the atta/multigrain market and from mass-customisation
pioneers before the Lab UI is designed. Every claim below is sourced; the
"we learn" columns are proposals, not committed scope.

---

## 1 · The Indian multigrain-atta landscape

| Brand | Positioning | Disclosure | Packs / channel | Note for us |
|---|---|---|---|---|
| **Rebalance** (rebalance.kitchen) | D2C premium multigrain; khapli wheat base, low-GI story | **exact % of every grain on the pack** — their core differentiator; 14.5 g protein, 11 g fibre | brand site + **subscription** | Closest analogue to our transparency promise; their blog attacks competitors for hiding percentages |
| **Aashirvaad Multigrain** (ITC) | mass-market health | percentages **not disclosed** | 1/5 kg, all marketplaces | The industry norm we define ourselves against |
| **Saffola Multigrain** | heart-health mainstream | partial | marketplaces | health-claim-heavy copy — FSSAI caution |
| **Organic Tattva** | certified organic, single-flour SKUs (jowar ₹85→70) | ingredient list only | 1/5 kg D2C | single-flour long-tail is a possible later catalogue extension |
| **Slurrp Farm** | millet-forward, families/kids | partial | D2C + Amazon | audience-segmented blends |
| **Two Brothers Organic Farms** | premium khapli D2C | farm story | 1/5 kg D2C | provenance storytelling |
| **Sugar.fit / Amwel / Mobile Chakki** | **diabetic / low-GI** atta | Amwel prints "75% wheat / 25% millets" | 1–5 kg, marketplaces | Our "Sugar Care" enters a crowded, claim-sensitive lane |
| Market size | packaged atta projected **₹40,000 crore by 2027** | | | category is growing, not niche |

**Reading:** in this category, *disclosed percentages are the trust currency*.
The winner-flavour of marketing is "we show, they hide". ArogyaBhog's Lab is the
strongest possible form of that: the customer doesn't just read percentages,
they **set** them.

## 2 · Mass-customisation UX: mymuesli (the category pioneer, est. 2007)

- First custom-cereal configurator ("Mixer"): pick a base, add from 75+
  ingredients, **name your blend**, personalise the packaging.
- Academic findings (ResearchGate case study; ScienceDirect 2019):
  configuring is **cognitively costly** — customers struggle to predict joint
  taste; mymuesli later opened stores so people could *taste first*, and
  reducing interaction cost **increased demand**.
- Price-premium finding: replicating premium standard mueslis in the
  configurator cost **~60% more**; the mass-customisation literature cites
  **10–20%** as the acceptable premium ceiling for customised goods.
- General Mills' `mycereal.com` attempted the same and **never launched at
  scale** (high cost, unreceptive public) — customisation needs demand fit.

## 3 · Radical transparency as a business model: Everlane

- Per-item **"true cost" breakdown**: materials, labour, transport, duties —
  then the markup, stated openly (**2× cost vs an industry norm of 8–10×**).
- D2C-only, no discounting, minimal ad spend; transparency *is* the marketing.
- Result: trust that justifies a premium and turns customers into advocates.

---

## 4 · What we learn (proposals → backlog, client decides)

| # | Lesson | Source | Proposed action |
|---|---|---|---|
| L1 | Percentage disclosure is the category's trust currency | Rebalance vs Aashirvaad | Print **exact grain % on premade PDPs** too (we already store the ratios) — don't reserve disclosure for the Lab |
| L2 | Configurators impose cognitive cost; templates relieve it | mymuesli stores/ScienceDirect | Lab opens **from a premade template** ("start from Everyday Atta"), premade cards sit on the same page (already planned), goal-based presets later |
| L3 | Custom mixes priced far above premade equivalents choke | mymuesli ~60% vs 10–20% ceiling | Set the Price Consistency Checker's **warn threshold at +15–20%** Lab-vs-premade; this is exactly the arbitrage FINDING-1 exposed (Thyro +40%) |
| L4 | Naming creates ownership | mymuesli "name your muesli" | Lab's saved mixes get a **customer-chosen name** (save-mix already on the brand board) |
| L5 | Component-level cost breakdown builds trust and justifies price | Everlane | Our line-by-line panel (grain + milling ₹4/kg + packaging ₹5 + delivery + GST) is Everlane-grade; add an optional admin-editable "why this price" story block |
| L6 | Atta is a replenishment purchase | Rebalance subscription | Post-launch roadmap: **monthly subscription** (recurring revenue, fixes low frequency of a high-AOV cart) |
| L7 | Comparison/education content wins SEO in this category | Rebalance blog | Blog/GEO plan (ADR-020) should include "how to read a multigrain label"-class posts |
| L8 | Diabetic/low-GI lane is crowded and claim-regulated | Sugar.fit, Amwel, Mobile Chakki | Reinforces BLOCKER-3: no glycaemic claims in copy until substantiated; names stay client-editable |
| L9 | Entry packs in-market are 1–5 kg | all of §1 | Re-open the **5 kg entry pack** question with this evidence (ADR-021 fixed 10/15/20 on client instruction; a ₹950 minimum order is an outlier vs ₹179–350 entry points) — client's call, not mine |
| L10 | Marketplaces are where volume lives | Flipkart/Amazon listings | Launch D2C-only is right (own drivers, COD/UPI), but the sheet's Meesho/wholesale columns suggest a **later marketplace channel**; keep SKU/pricing model channel-ready |

## 5 · What we deliberately do NOT copy

- Hidden grain percentages (the category's default dishonesty).
- Disease-adjacent claim copy ("sugar control", "thyro cure") — FSSAI Reg 10(1).
- Opaque 8–10× markups — incompatible with the brand and with ADR-008's
  customer-visible breakdown.
- 75-ingredient configurator freedom — our caps and base-grain floor are
  features (safety + millability), not limitations; 12-item max is deliberate.

## Sources

- rebalance.kitchen — "Buy multigrain atta online India: best options compared" (Jul 2026) and "2026 shortlist" (Jul 2026)
- organictattva.com/collections/flours-suji; flipkart.com wheat-atta listings; reviewsky.in top-10 atta 2026
- labelprint24.com/en/mymuesli (case study); nichebrand.com/mymuesli; ResearchGate 273512663 "Mass Customization in der Lebensmittelbranche"; ScienceDirect S0925527319302646 (2019)
- d3.harvard.edu/platform-rctom — "Everlane: Winning with Radical Transparency"; llbrandlab.com Everlane brand-value analysis
