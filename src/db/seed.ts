/**
 * Seeder for the vertical slice. Reads the frozen discovery artefacts so the
 * database always starts from the same verified numbers:
 *   - seed-ingredient-rates.json     (ADR-026 provisional rates + provenance)
 *   - ifct2017-mapped-nutrients.json (ADR-007 primary source, values ×100)
 *   - usda-fallback-nutrients.json   (ADR-007 fallback for IFCT gaps)
 *   - seed-premade-recipes.json      (blend compositions in bps)
 *
 * Third tier (ADR-030): when IFCT and USDA both fail, another national food
 * composition table may supply a FULL profile, one source per nutrient row.
 * Psyllium (RM-011) resolved 2026-10-12 via Frida NO (Matvaretabellen food
 * 05.465, Plantago ovata, 18/18 nutrients) — USDA had Branded-only, corrupt
 * iron; IFCT citations conflicted between secondary mirrors.
 * Pumpkin resolved via FDC 170556 (SR Legacy, 12/12, kJ→kcal patched).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { hashPassword } from '../server/passwords';
import {
  ingredientNutrition,
  ingredients,
  productRecipeLines,
  products,
  productVariants,
  stores,
  users,
} from './schema';

export const SEED_STORE_ID = 'st_knp_01';

/** Dev-only credentials (printed by /login in dev). Rotated at deploy time —
 *  the seeder hashes at runtime, so no hash literal ever lands in git. */
const DEV_ADMIN_HASH = hashPassword(process.env.DEV_ADMIN_PASSWORD ?? 'arogyabhog-dev-admin');
const DEV_MANAGER_HASH = hashPassword(process.env.DEV_MANAGER_PASSWORD ?? 'arogyabhog-dev-manager');

/** ingredient id → profile key in the IFCT json, else the USDA json */
const NUTRIENT_PROFILE: Record<string, string> = {
  'RM-001': 'Whole Wheat (Sharbati)',
  'RM-002': 'Barley (Jau)',
  'RM-003': 'Barley (Jau)',
  'RM-004': 'Bengal gram whole (Kala Chana)',
  'RM-005': 'Bengal gram whole (Kala Chana)',
  'RM-006': 'Soya bean',
  'RM-007': 'Jowar',
  'RM-008': 'Ragi',
  'RM-009': 'Bajra',
  'RM-010': 'Linseed (Alsi)',
  'RM-012': 'Kuttu (Buckwheat)', // USDA fallback
  'RM-013': 'Green gram dal (Moong)',
  'RM-014': 'Chia Seeds', // USDA fallback
  'RM-015': 'Gingelly/Sesame white (Til)',
  'RM-016': 'Pumpkin Seeds (Kaddu Beej)', // USDA fallback
  'RM-017': 'Sunflower seeds',
  'RM-018': 'Fenugreek seeds (Methi)',
  'RM-011': 'Psyllium Husk (Isabgol)', // Frida NO tier (ADR-030)
};

const SINGLES: Array<{ slug: string; name: string; ingredientId: string; desc: string }> = [
  {
    slug: 'sharbati-wheat-atta',
    name: 'Sharbati Wheat Atta',
    ingredientId: 'RM-001',
    desc: 'Single-origin Sharbati wheat, stone-milled whole. The rotli default of north India.',
  },
  {
    slug: 'jau-atta',
    name: 'Jau Atta (Barley)',
    ingredientId: 'RM-002',
    desc: 'Whole barley flour — soft, slightly sweet, fibre-rich; blends well into wheat rotis.',
  },
  {
    slug: 'jowar-atta',
    name: 'Jowar Atta (Sorghum)',
    ingredientId: 'RM-007',
    desc: 'Whole jowar flour for bhakri and soft rotis; a millet staple of central India.',
  },
  {
    slug: 'ragi-atta',
    name: 'Ragi Atta (Finger Millet)',
    ingredientId: 'RM-008',
    desc: 'Deep-coloured ragi flour — calcium-rich, malted-note flavour for rotis and dosas.',
  },
  {
    slug: 'bajra-atta',
    name: 'Bajra Atta (Pearl Millet)',
    ingredientId: 'RM-009',
    desc: 'Hearty pearl-millet flour, the winter bajri rotla classic.',
  },
  {
    slug: 'moong-dal-flour',
    name: 'Moong Dal Flour',
    ingredientId: 'RM-013',
    desc: 'Fine-milled yellow moong dal — besan-style base for cheela, pakodi and sweets.',
  },
];

const META: Record<string, { category: string; base: boolean; cap: number | null }> = {
  'RM-001': { category: 'Base Grain', base: true, cap: null },
  'RM-002': { category: 'Standard Grain', base: false, cap: null },
  'RM-003': { category: 'Premium Grain', base: false, cap: null },
  'RM-004': { category: 'Standard Pulse', base: false, cap: null },
  'RM-005': { category: 'Premium Pulse', base: false, cap: null },
  'RM-006': { category: 'High-Protein Legume', base: false, cap: null },
  'RM-007': { category: 'Millet', base: false, cap: null },
  'RM-008': { category: 'Millet', base: false, cap: null },
  'RM-009': { category: 'Millet', base: false, cap: null },
  'RM-010': { category: 'Oilseed / Omega-3', base: false, cap: null },
  'RM-011': { category: 'Soluble Fiber', base: false, cap: 300 }, // psyllium ≤ 3%
  'RM-012': { category: 'Gluten-Free Grain', base: false, cap: null },
  'RM-013': { category: 'Pulse', base: false, cap: null },
  'RM-014': { category: 'Seed', base: false, cap: 1500 }, // seeds ≤ 15%
  'RM-015': { category: 'Seed', base: false, cap: 1500 },
  'RM-016': { category: 'Seed', base: false, cap: 1500 },
  'RM-017': { category: 'Seed', base: false, cap: 1500 },
  'RM-018': { category: 'Spice Seed', base: false, cap: null },
};

const PREMADE: Record<string, { name: string; slug: string; sell10: number; cost10: number; provisional?: boolean }> = {
  everyday: { name: 'ArogyaBhog Everyday Atta', slug: 'everyday-atta', sell10: 95000, cost10: 55650 },
  sugar_care: { name: 'ArogyaBhog Sugar Care Atta', slug: 'sugar-care-atta', sell10: 125000, cost10: 70600 },
  high_protein: {
    name: 'ArogyaBhog High-Protein Fitness Atta',
    slug: 'high-protein-atta',
    sell10: 135000,
    cost10: 73100,
  },
  thyro_care: { name: 'ArogyaBhog Thyro-Care Atta', slug: 'thyro-care-atta', sell10: 165000, cost10: 125500 },
  // Dashboard MRP cell is corrupt; midpoint of the sheet's 1100/1400 band (ADR-026).
  vitality: {
    name: 'ArogyaBhog Vitality Atta',
    slug: 'vitality-atta',
    sell10: 125000,
    cost10: 97500,
    provisional: true,
  },
};

interface RateRow {
  ingredient_id: string;
  name: string;
  cost_paise_per_kg: number;
  cost_source: string;
  sell_paise_per_kg: number;
  sell_source: string;
  rates_provisional: boolean;
  review_note: string;
}

function readJson(rel: string): unknown {
  return JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
}

export async function seedDatabase(db: LibSQLDatabase): Promise<void> {
  const rates = readJson('discovery/seed-ingredient-rates.json') as RateRow[];
  const ifct = readJson('discovery/ifct2017-mapped-nutrients.json') as Record<string, Record<string, unknown>>;
  const usda = readJson('discovery/usda-fallback-nutrients.json') as Record<string, Record<string, unknown>>;
  const frida = readJson('discovery/frida-national-table-nutrients.json') as Record<string, Record<string, unknown>>;
  /** ADR-007 tiers, last wins never: IFCT primary, USDA fallback, then other
   *  national tables (ADR-030). Keys are disjoint per ingredient by design. */
  const profiles: Record<string, Record<string, unknown>> = { ...frida, ...usda, ...ifct };
  const recipes = readJson('discovery/seed-premade-recipes.json') as Record<
    string,
    { lines: Array<{ ingredient_id: string; ratio_bps: number }> }
  >;

  await db.insert(stores).values({
    id: SEED_STORE_ID,
    name: 'ArogyaBhog Kanpur',
    city: 'Kanpur, UP',
    allowedPackSizesG: JSON.stringify([5000, 10000, 15000, 20000]),
    minBaseGrainBps: 6000,
    millingFeePaisePerKg: 400,
    packagingFeePaise: 500,
    deliveryFeePaise: 5000,
    gstRateBps: 500,
  });

  await db.insert(users).values({
    id: 'us_mgr_seed',
    role: 'MANAGER',
    storeId: SEED_STORE_ID,
    email: 'manager@arogyabhog.local',
    passwordHash: DEV_MANAGER_HASH,
    displayName: 'Kanpur Manager',
    referralCode: 'MGR00001',
    freeDeliveryCredits: 1,
  });

  await db.insert(users).values({
    id: 'us_admin_seed',
    role: 'ADMIN',
    storeId: null,
    email: 'owner@arogyabhog.local',
    passwordHash: DEV_ADMIN_HASH, // dev-only credential; rotated at deploy
    displayName: 'Owner',
    referralCode: 'OWNER0001',
    freeDeliveryCredits: 1,
  });

  for (const r of rates) {
    const meta = META[r.ingredient_id];
    if (!meta) throw new Error(`seed: no META for ${r.ingredient_id}`);
    await db.insert(ingredients).values({
      id: r.ingredient_id,
      storeId: SEED_STORE_ID,
      name: r.name,
      category: meta.category,
      isBaseGrain: meta.base,
      maxPctBps: meta.cap,
      costPaisePerKg: r.cost_paise_per_kg,
      sellPaisePerKg: r.sell_paise_per_kg,
      costSource: r.cost_source,
      sellSource: r.sell_source,
      ratesProvisional: r.rates_provisional,
      reviewNote: r.review_note || null,
    });

    const profileKey = NUTRIENT_PROFILE[r.ingredient_id];
    if (!profileKey) continue; // no profile in any source: unmixable on purpose
    const profile = profiles[profileKey];
    if (!profile) throw new Error(`seed: missing profile ${profileKey}`);
    const rows = Object.entries(profile)
      .filter(([k, v]) => typeof v === 'number' && k !== 'fdc_id')
      .map(([k, v]) => ({
        ingredientId: r.ingredient_id,
        nutrientKey: k,
        valueX100: Math.round((v as number) * 100),
        source: String(profile.source ?? 'IFCT-2017 (ICMR-NIN)'),
        sourceCode:
          typeof profile.ifct_code === 'string'
            ? profile.ifct_code
            : typeof profile.fdc_id === 'number'
              ? `FDC ${profile.fdc_id}`
              : null,
      }));
    if (rows.length === 0) throw new Error(`seed: empty nutrition for ${profileKey}`);
    await db.insert(ingredientNutrition).values(rows);
  }

  for (const [key, p] of Object.entries(PREMADE)) {
    const recipe = recipes[key];
    if (!recipe) throw new Error(`seed: missing recipe ${key}`);
    const productId = `pr_${key}`;
    await db.insert(products).values({
      id: productId,
      storeId: SEED_STORE_ID,
      name: p.name,
      slug: p.slug,
      kind: 'premade',
      description: null,
    });
    /** ADR-021 packs 10/15/20 kg; larger packs price linearly off the 10 kg
     *  sheet rate (client can re-rate per pack in admin later). */
    await db.insert(productVariants).values(
      [10000, 15000, 20000].map((g) => ({
        id: `pv_${key}_${g / 1000}`,
        productId,
        packSizeG: g,
        costPaise: (p.cost10 * g) / 10000,
        sellPaise: (p.sell10 * g) / 10000,
        sellSource: p.provisional ? 'seed_sheet_midpoint' : 'client_sheet_2026',
        provisional: Boolean(p.provisional),
      })),
    );
    await db.insert(productRecipeLines).values(
      recipe.lines.map((l) => ({
        productId,
        ingredientId: l.ingredient_id,
        ratioBps: l.ratio_bps,
      })),
    );
  }

  /* Single-grain flours (ADR-029): one ingredient, milled — the market-standard
   * SKUs (wheat atta, jau atta, …). Packs 1/5/10 kg; rates inherit the
   * provisional per-kg ingredient rates until the client re-prices. */
  const sellPerKg = new Map(rates.map((r) => [r.ingredient_id, r.sell_paise_per_kg]));
  const costPerKg = new Map(rates.map((r) => [r.ingredient_id, r.cost_paise_per_kg]));
  for (const sg of SINGLES) {
    const productId = `pr_${sg.slug}`;
    await db.insert(products).values({
      id: productId,
      storeId: SEED_STORE_ID,
      name: sg.name,
      slug: sg.slug,
      kind: 'single',
      description: sg.desc,
    });
    /** Client rule 2026-10-13: 5 kg exists ONLY for custom mixes; every
     *  boxed product sells 10/15/20 kg (ADR-029 amendment). */
    await db.insert(productVariants).values(
      [10000, 15000, 20000].map((g) => ({
        id: `pv_${sg.slug}_${g / 1000}`,
        productId,
        packSizeG: g,
        costPaise: ((costPerKg.get(sg.ingredientId) ?? 0) * g) / 1000,
        sellPaise: ((sellPerKg.get(sg.ingredientId) ?? 0) * g) / 1000,
        sellSource: 'ingredient_rate_provisional',
        provisional: true,
      })),
    );
    await db.insert(productRecipeLines).values({
      productId,
      ingredientId: sg.ingredientId,
      ratioBps: 10000,
    });
  }
}
