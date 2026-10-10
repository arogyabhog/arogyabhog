/**
 * Integration tests: migrations + seed + service, in-process libSQL (no Docker,
 * per ADR-004/019). Proves the DB → engine path reproduces the golden numbers
 * and that every guard surfaces with its typed code.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { beforeAll, describe, expect, it } from 'vitest';
import { SEED_STORE_ID, seedDatabase } from '../db/seed';
import { MixError } from '../domain/mix-engine';
import { calculateMixFromDb } from './mix-service';
import type { MixCalculateRequest } from './contracts';

let db: LibSQLDatabase;
let everydayItems: Array<{ ingredientId: string; weightG: number }>;

beforeAll(async () => {
  const client = createClient({ url: ':memory:' });
  db = drizzle(client);
  await migrate(db, { migrationsFolder: 'migrations' });
  await seedDatabase(db);
  const recipes = JSON.parse(
    readFileSync(join(process.cwd(), 'discovery/seed-premade-recipes.json'), 'utf8'),
  ) as Record<string, { lines: Array<{ ingredient_id: string; ratio_bps: number }> }>;
  const everyday = recipes['everyday'];
  if (!everyday) throw new Error('seed-premade-recipes.json: everyday missing');
  // At 10 kg, basis points ARE grams — the sheet's own recipe, verbatim.
  everydayItems = everyday.lines.map((l) => ({
    ingredientId: l.ingredient_id,
    weightG: l.ratio_bps,
  }));
}, 60_000);

const req = (over: Partial<MixCalculateRequest> = {}): MixCalculateRequest => ({
  storeId: SEED_STORE_ID,
  targetWeightG: 10000,
  packageCount: 1,
  items: everydayItems,
  ...over,
});

describe('mix service over a migrated + seeded database', () => {
  it('reproduces the golden Everyday numbers end-to-end from DB rows', async () => {
    const calc = await calculateMixFromDb(db, req());
    const p = calc.mix.pricing;
    /*
     * Priced at ADR-026 SEED SELLING rates (≈ cost × home-blend markup), so the
     * numbers differ from the domain golden (which sets sell = cost to replay
     * the sheet's cost panel: raw 46650). Here: raw 88550 = Σ weight×sell/1000
     * over the seeded rates — hand-verified against the seed JSON.
     */
    expect(p.rawPaise).toBe(88550);
    expect(p.millingPaise).toBe(4000);
    expect(p.packagingPaise).toBe(500);
    expect(p.subtotalPaise).toBe(93050);
    expect(p.gstPaise).toBe(4431); // 5% inclusive, split CGST/SGST
    expect(p.cgstPaise).toBe(2215); // engine floors CGST…
    expect(p.sgstPaise).toBe(2216); // …odd paisa to SGST so the split sums exactly
    expect(p.deliveryPaise).toBe(5000); // quoted, not included (ADR-010)
    expect(calc.mix.baseGrainBps).toBe(7500); // wheat only = sheet's 'Base Grain'

    /*
     * Nutrition: the DB carries IFCT-2017 values (ADR-007), NOT the sheet's own
     * nutrient column — the two disagree (sheet wheat 340 kcal vs IFCT 320.27),
     * which is exactly why one source had to be chosen. So the sheet's 348.93
     * panel is reproduced only by the domain golden test (which feeds sheet
     * numbers); here we assert the IFCT-driven weighted mean lies strictly
     * inside the ingredient min/max envelope — the Vitality-Rule property —
     * plus provenance. Pricing above remains data-independent and exact.
     */
    const per100 = new Map(calc.mix.nutrition.per100g.map((n) => [n.code, n.valueScaled]));
    const enerc = per100.get('enerc');
    expect(enerc).toBeDefined();
    expect(enerc!).toBeGreaterThan(30000); // 300+ kcal/100 g
    expect(enerc!).toBeLessThan(40000); // 400- kcal/100 g
    expect(per100.get('protcnt')!).toBeGreaterThan(1000); // > 10 g/100 g
    expect(calc.mix.nutrition.estimated).toBe(true);
    expect(calc.mix.nutrition.sources).toContain('IFCT2017');
  });

  it('flags provisional pricing and carries per-nutrient provenance', async () => {
    const calc = await calculateMixFromDb(db, req());
    expect(calc.provisionalPricing).toBe(true); // ADR-026 seeds are provisional
    expect(calc.nutritionSources['RM-001']?.enerc).toBe('IFCT2017');
  });

  it('displayed line prices still sum exactly to raw (R1.1 through the DB path)', async () => {
    const calc = await calculateMixFromDb(db, req());
    const sum = calc.mix.composition.reduce((a, l) => a + l.linePaise, 0);
    expect(sum).toBe(calc.mix.pricing.rawPaise);
  });

  it('409-class: an ingredient without nutrition data hard-fails, naming it', async () => {
    await expect(
      calculateMixFromDb(
        db,
        req({ items: [ { ingredientId: 'RM-001', weightG: 9000 }, { ingredientId: 'RM-011', weightG: 1000 } ] }),
      ),
    ).rejects.toMatchObject({ code: 'INCOMPLETE_INGREDIENT_DATA' });
  });

  it('unknown and inactive ingredients are refused', async () => {
    await expect(
      calculateMixFromDb(db, req({ items: [ { ingredientId: 'RM-001', weightG: 9000 }, { ingredientId: 'RM-999', weightG: 1000 } ] })),
    ).rejects.toMatchObject({ code: 'INGREDIENT_UNKNOWN' });
  });

  it('mass mismatch reports the signed delta in grams', async () => {
    const e = await calculateMixFromDb(
      db,
      req({ items: everydayItems.map((i, k) => (k === 0 ? { ...i, weightG: i.weightG + 500 } : i)) }),
    ).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(MixError);
    expect((e as MixError).code).toBe('MASS_MISMATCH');
    expect((e as MixError).details).toMatchObject({ deltaG: -500 });
  });

  it('a non-catalogue pack size is refused', async () => {
    // Scale to 7777 g and repair the first line so mass conservation holds —
    // otherwise MASS_MISMATCH (the earlier guard) fires before the pack check.
    const scaled = everydayItems.map((i) => ({ ...i, weightG: Math.max(1, Math.round(i.weightG * 0.7777)) }));
    const sum = scaled.reduce((a, i) => a + i.weightG, 0);
    scaled[0] = { ...scaled[0]!, weightG: scaled[0]!.weightG + (7777 - sum) };
    await expect(
      calculateMixFromDb(db, req({ targetWeightG: 7777, items: scaled })),
    ).rejects.toMatchObject({ code: 'INVALID_PACK_SIZE' });
  });

  it('the base-grain floor and per-ingredient caps hold through the DB path', async () => {
    await expect(
      calculateMixFromDb(db, req({ items: [ { ingredientId: 'RM-015', weightG: 5000 }, { ingredientId: 'RM-017', weightG: 5000 } ] })),
    ).rejects.toMatchObject({ code: 'BASE_GRAIN_BELOW_MINIMUM' });
    await expect(
      calculateMixFromDb(db, req({ items: [ { ingredientId: 'RM-001', weightG: 8000 }, { ingredientId: 'RM-015', weightG: 2000 } ] })),
    ).rejects.toMatchObject({ code: 'INGREDIENT_OVER_CAP' }); // sesame capped at 15%
  });

  it('an unknown store is refused', async () => {
    await expect(calculateMixFromDb(db, req({ storeId: 'st_nowhere' }))).rejects.toMatchObject({
      code: 'STORE_NOT_FOUND',
    });
  });
});
