/**
 * Blend nutrition (pure): weight each ingredient's per-100 g profile by its
 * share of the blend. Integer discipline like the rest of the domain — values
 * arrive as real per-100 g numbers, are scaled ×100 internally, and results
 * carry their coverage in bps so the UI can be honest about gaps (ADR-007:
 * estimated, never silently extrapolated).
 */

export interface NutrientMeta {
  label: string;
  unit: 'kcal' | 'g' | 'mg' | 'µg';
  group: 'macronutrients' | 'minerals' | 'vitamins';
}

export const NUTRIENT_META: Readonly<Record<string, NutrientMeta>> = {
  enerc: { label: 'Energy', unit: 'kcal', group: 'macronutrients' },
  protcnt: { label: 'Protein', unit: 'g', group: 'macronutrients' },
  fatce: { label: 'Total fat', unit: 'g', group: 'macronutrients' },
  fasat: { label: 'Saturated fat', unit: 'g', group: 'macronutrients' },
  fapu: { label: 'Polyunsaturated fat', unit: 'g', group: 'macronutrients' },
  choavldf: { label: 'Carbohydrate', unit: 'g', group: 'macronutrients' },
  fibtg: { label: 'Dietary fibre', unit: 'g', group: 'macronutrients' },
  ca: { label: 'Calcium', unit: 'mg', group: 'minerals' },
  fe: { label: 'Iron', unit: 'mg', group: 'minerals' },
  zn: { label: 'Zinc', unit: 'µg', group: 'minerals' },
  mg: { label: 'Magnesium', unit: 'mg', group: 'minerals' },
  p: { label: 'Phosphorus', unit: 'mg', group: 'minerals' },
  k: { label: 'Potassium', unit: 'mg', group: 'minerals' },
  na: { label: 'Sodium', unit: 'mg', group: 'minerals' },
  thia: { label: 'Thiamin (B1)', unit: 'µg', group: 'vitamins' },
  ribf: { label: 'Riboflavin (B2)', unit: 'µg', group: 'vitamins' },
  nia: { label: 'Niacin (B3)', unit: 'mg', group: 'vitamins' },
  folsum: { label: 'Folate (total)', unit: 'µg', group: 'vitamins' },
};

export const NUTRIENT_GROUP_ORDER = ['macronutrients', 'minerals', 'vitamins'] as const;

export interface BlendIngredientProfile {
  /** Share of the blend in basis points (Σ must be 10000 for a full recipe). */
  bps: number;
  /** nutrient code → per-100 g amount in the unit given by NUTRIENT_META. */
  values: Record<string, number>;
}

export interface BlendNutrientRow {
  code: string;
  label: string;
  unit: NutrientMeta['unit'];
  group: NutrientMeta['group'];
  /** Weighted amount per 100 g of blend (2-dp exactness, ×100 integer internally). */
  per100g: number;
  /** Amount in one pack of packWeightG (same unit). */
  perPack: number;
  /** bps of the blend this row actually covers (< 10000 ⇒ underestimate, disclosed). */
  coverageBps: number;
}

/** Weighted per-100 g nutrition for a blend, with per-row coverage honesty. */
export function blendNutrition(profiles: readonly BlendIngredientProfile[], packWeightG: number): BlendNutrientRow[] {
  if (!Number.isInteger(packWeightG) || packWeightG <= 0) {
    throw new Error(`blendNutrition: packWeightG must be a positive integer, got ${packWeightG}`);
  }
  const sumX100 = new Map<string, number>(); // Σ bps × valueX100
  const coverage = new Map<string, number>(); // Σ bps where value exists

  for (const p of profiles) {
    if (!Number.isInteger(p.bps) || p.bps < 0) throw new Error(`blendNutrition: bad bps ${p.bps}`);
    for (const [code, v] of Object.entries(p.values)) {
      if (!NUTRIENT_META[code]) continue; // unknown codes are ignored, never invented
      const valueX100 = Math.round(v * 100);
      sumX100.set(code, (sumX100.get(code) ?? 0) + p.bps * valueX100);
      coverage.set(code, (coverage.get(code) ?? 0) + p.bps);
    }
  }

  const rows: BlendNutrientRow[] = [];
  for (const [code, total] of sumX100) {
    const meta = NUTRIENT_META[code];
    if (!meta) continue;
    const cov = coverage.get(code) ?? 0;
    if (cov <= 0) continue;
    // per100gX100 = Σ bps×valueX100 / 10000 (bps are parts of 10000)
    const per100gX100 = Math.round(total / 10000);
    const perPackX100 = Math.round((per100gX100 * packWeightG) / 100);
    rows.push({
      code,
      label: meta.label,
      unit: meta.unit,
      group: meta.group,
      per100g: per100gX100 / 100,
      perPack: perPackX100 / 100,
      coverageBps: cov,
    });
  }
  const groupRank: Record<NutrientMeta['group'], number> = { macronutrients: 0, minerals: 1, vitamins: 2 };
  rows.sort(
    (a, b) =>
      groupRank[a.group] - groupRank[b.group] ||
      Object.keys(NUTRIENT_META).indexOf(a.code) - Object.keys(NUTRIENT_META).indexOf(b.code),
  );
  return rows;
}

/** Human amount with automatic unit scaling for big totals (µg→mg→g, mg→g, g→kg). */
export function formatAmount(value: number, unit: NutrientMeta['unit']): string {
  let v = value;
  let u: string = unit; // display unit may scale beyond the canonical set (kg)
  if (u === 'µg' && v >= 1000) {
    v /= 1000;
    u = 'mg';
  }
  if (u === 'mg' && v >= 1000) {
    v /= 1000;
    u = 'g';
  }
  if (u === 'g' && v >= 1000) {
    v /= 1000;
    u = 'kg';
  }
  const digits = v >= 100 ? 0 : v >= 10 ? 1 : 2;
  // trim trailing zeros ONLY in the fractional part — "390" must stay 390
  const s = v
    .toFixed(digits)
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '');
  return `${s} ${u}`;
}
