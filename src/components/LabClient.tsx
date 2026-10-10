'use client';

/**
 * The Lab — compose a flour under the real constraints (ADR-013), priced and
 * nutrition-labelled by the verified engine through
 * POST /api/storefront/mix/calculate. Client shows live guidance; the SERVER
 * result is the only truth shown in the certificate.
 */
import { useEffect, useMemo, useState } from 'react';

export interface IngProp {
  id: string;
  name: string;
  category: string | null;
  isBaseGrain: boolean;
  maxPctBps: number | null;
  hasNutrition: boolean;
}
export interface PreMadeProp {
  name: string;
  slug: string;
  img: string;
  sellPaise: number;
  provisional: boolean;
  lines: Array<{ name: string; bps: number }>;
  template: Array<{ id: string; g: number }>;
}
interface MixResponse {
  mix: {
    baseGrainBps: number;
    composition: Array<{
      ingredientId: string;
      name: string;
      weightG: number;
      ratioBps: number;
      displayPercent: string;
      linePaise: number;
    }>;
    nutrition: {
      per100g: Array<{ code: string; valueScaled: number; sources: string[] }>;
      estimated: boolean;
      sources: string[];
    };
    pricing: {
      rawPaise: number;
      millingPaise: number;
      packagingPaise: number;
      subtotalPaise: number;
      gstPaise: number;
      cgstPaise: number;
      sgstPaise: number;
      deliveryPaise: number;
      totalPaise: number;
    };
  };
  provisionalPricing: boolean;
  notice: string;
}
interface ErrResponse {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

const NUTR: Array<[string, string, string]> = [
  ['enerc', 'Energy', 'kcal'],
  ['protcnt', 'Protein', 'g'],
  ['fatce', 'Fat', 'g'],
  ['fibtg', 'Dietary fibre', 'g'],
  ['choavldf', 'Carbohydrate', 'g'],
  ['ca', 'Calcium', 'mg'],
  ['fe', 'Iron', 'mg'],
  ['zn', 'Zinc', 'µg'],
  ['mg', 'Magnesium', 'mg'],
  ['p', 'Phosphorus', 'mg'],
  ['k', 'Potassium', 'mg'],
  ['na', 'Sodium', 'mg'],
];

const HINTS: Record<string, string> = {
  BASE_GRAIN_BELOW_MINIMUM:
    'At least 60% of the mix must be base grain (Sharbati wheat). Add wheat, or trim seeds and pulses.',
  INGREDIENT_OVER_CAP: 'That ingredient is above its safety cap for a single mix. Reduce its share.',
  MASS_MISMATCH: 'Your gram weights must sum exactly to the chosen pack size — use “Snap to pack”.',
  INVALID_PACK_SIZE: 'Pick one of the house pack sizes.',
  INGREDIENT_TOO_SMALL: 'An ingredient is below 1 g at this pack size — raise its share or remove it.',
  INCOMPLETE_INGREDIENT_DATA: 'We refuse to guess missing data. This ingredient’s published nutrition is incomplete.',
};

const inr = (p: number) =>
  `₹${(p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function LabClient(props: {
  storeId: string;
  packs: number[];
  ingredients: IngProp[];
  preMades: PreMadeProp[];
  template: Array<{ id: string; g: number }>;
}) {
  const { storeId, packs, ingredients, template } = props;
  const [grams, setGrams] = useState<Record<string, number>>(() =>
    Object.fromEntries(template.map((t) => [t.id, t.g])),
  );
  const [pack, setPack] = useState(10000);
  const [res, setRes] = useState<MixResponse | null>(null);
  const [err, setErr] = useState<ErrResponse['error'] | null>(null);

  const total = useMemo(() => Object.values(grams).reduce((a, b) => a + b, 0), [grams]);
  const baseG = useMemo(
    () => ingredients.filter((i) => i.isBaseGrain).reduce((a, i) => a + (grams[i.id] ?? 0), 0),
    [grams, ingredients],
  );
  const basePct = total > 0 ? (baseG / total) * 100 : 0;
  const items = useMemo(
    () =>
      Object.entries(grams)
        .filter(([, g]) => g > 0)
        .map(([ingredientId, weightG]) => ({ ingredientId, weightG })),
    [grams],
  );

  useEffect(() => {
    if (items.length < 2) {
      setRes(null);
      setErr(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await fetch('/api/storefront/mix/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storeId, targetWeightG: pack, packageCount: 1, items }),
        });
        const j = await r.json();
        if (r.ok) {
          setRes(j as MixResponse);
          setErr(null);
        } else {
          setRes(null);
          setErr((j as ErrResponse).error);
        }
      } catch {
        setRes(null);
        setErr({ code: 'NETWORK', message: 'Could not reach the mill. Retry.' });
      }
    }, 350);
    return () => clearTimeout(t);
  }, [items, pack, storeId]);

  const snap = () => {
    if (total <= 0) return;
    const next: Record<string, number> = {};
    let acc = 0;
    const entries = Object.entries(grams).filter(([, g]) => g > 0);
    entries.forEach(([id, g], idx) => {
      if (idx === entries.length - 1) next[id] = pack - acc;
      else {
        const v = Math.max(0, Math.round((g / total) * pack));
        next[id] = v;
        acc += v;
      }
    });
    setGrams((prev) => ({ ...prev, ...next }));
  };

  return (
    <section id="lab" className="mx-auto max-w-6xl px-5 pt-24">
      <div className="text-xs font-bold uppercase tracking-[0.14em] text-gold-700">The Lab</div>
      <h2 className="mt-2 font-display text-3xl font-semibold text-ink-900">Compose your own atta</h2>
      <p className="mt-2 max-w-2xl text-[15px] leading-7 text-ink-500">
        Set grams per ingredient. We enforce the house rules for you — 60% base grain minimum, safety caps on seeds and
        psyllium, exact pack weights — and price it rupee-by-rupee in the open.
      </p>
      <div className="gold-rule mt-4 mb-8" />

      <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr]">
        {/* ---- composer ---- */}
        <div className="rounded-card border border-ivory-300 bg-white p-5 shadow-warm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">Pack size</span>
            {packs.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPack(p)}
                className={`rounded-ctrl px-3 py-1.5 text-sm font-bold ${pack === p ? 'bg-gold-700 text-gold-100' : 'border border-ivory-300 text-ink-500 hover:border-gold-400'}`}
              >
                {p / 1000} kg
              </button>
            ))}
            <span className={`tnum ml-auto text-sm font-bold ${total === pack ? 'text-leaf' : 'text-danger'}`}>
              {total.toLocaleString('en-IN')} / {pack.toLocaleString('en-IN')} g
            </span>
            {total !== pack && (
              <button
                type="button"
                onClick={snap}
                className="rounded-ctrl border border-gold-500 px-3 py-1.5 text-xs font-bold text-gold-700 hover:bg-gold-100"
              >
                Snap to pack
              </button>
            )}
          </div>

          <div className="mt-4 space-y-3">
            {ingredients.map((ing) => {
              const g = grams[ing.id] ?? 0;
              const pct = total > 0 ? (g / total) * 100 : 0;
              const capPct = ing.maxPctBps ? ing.maxPctBps / 100 : null;
              return (
                <div
                  key={ing.id}
                  className={`rounded-ctrl border p-3 ${g > 0 ? 'border-gold-300 bg-gold-50' : 'border-ivory-200'}`}
                >
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-ink-900">{ing.name}</div>
                      <div className="text-[11px] text-ink-400">
                        {ing.category}
                        {ing.isBaseGrain && (
                          <span className="ml-2 rounded-full bg-leaf-soft px-2 py-0.5 font-bold text-leaf">
                            base grain
                          </span>
                        )}
                        {capPct !== null && (
                          <span className="ml-1 rounded-full bg-warn-soft px-2 py-0.5 font-bold text-warn">
                            ≤ {capPct}%
                          </span>
                        )}
                        {!ing.hasNutrition && (
                          <span className="ml-1 rounded-full bg-danger-soft px-2 py-0.5 font-bold text-danger">
                            nutrition pending
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="tnum w-24 text-right text-sm font-extrabold text-ink-900">{pct.toFixed(1)}%</div>
                    <input
                      type="number"
                      min={0}
                      max={pack}
                      step={50}
                      value={g}
                      disabled={!ing.hasNutrition}
                      onChange={(e) =>
                        setGrams((prev) => ({ ...prev, [ing.id]: Math.max(0, Number(e.target.value) || 0) }))
                      }
                      className="tnum w-24 rounded-ctrl border border-ivory-300 bg-ivory-50 px-2 py-1.5 text-right text-sm font-bold text-ink-900 focus:border-gold-500 focus:outline-none disabled:opacity-40"
                    />
                    <span className="w-8 text-[11px] font-bold text-ink-400">g</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={pack}
                    step={50}
                    value={g}
                    disabled={!ing.hasNutrition}
                    onChange={(e) => setGrams((prev) => ({ ...prev, [ing.id]: Number(e.target.value) }))}
                    className="mt-2 w-full accent-gold-600 disabled:opacity-40"
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-5">
            <div className="flex justify-between text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
              <span>Base grain floor · 60%</span>
              <span className={`tnum ${basePct >= 60 ? 'text-leaf' : 'text-danger'}`}>{basePct.toFixed(1)}%</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-ivory-200">
              <div
                className={`h-full ${basePct >= 60 ? 'bg-forest-600' : 'bg-danger'}`}
                style={{ width: `${Math.min(100, basePct)}%` }}
              />
            </div>
          </div>
        </div>

        {/* ---- the certificate ---- */}
        <div className="rounded-card border border-gold-400 bg-white p-6 shadow-warm">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-gold-700">
              Your blend · the full receipt
            </div>
            {res?.provisionalPricing && (
              <span className="rounded-full bg-warn-soft px-2.5 py-1 text-[10px] font-bold text-warn">
                indicative pricing
              </span>
            )}
          </div>
          <div className="gold-rule my-3" />

          {err && (
            <div className="rounded-ctrl bg-danger-soft p-4 text-sm leading-6 text-danger">
              <div className="font-bold">{err.code}</div>
              {HINTS[err.code] ?? err.message}
            </div>
          )}
          {!err && !res && (
            <div className="py-10 text-center text-sm text-ink-400">
              Add at least two ingredients to see the receipt.
            </div>
          )}

          {res && (
            <>
              <table className="w-full text-[13px]">
                <tbody>
                  {res.mix.composition.map((c) => (
                    <tr key={c.ingredientId} className="border-b border-ivory-100">
                      <td className="py-1.5 pr-2 text-ink-700">{c.name}</td>
                      <td className="tnum py-1.5 pr-2 text-right text-ink-400">{c.displayPercent}</td>
                      <td className="tnum py-1.5 pr-2 text-right text-ink-400">
                        {c.weightG.toLocaleString('en-IN')} g
                      </td>
                      <td className="tnum py-1.5 text-right font-semibold text-ink-900">{inr(c.linePaise)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-1.5 text-ink-500" colSpan={3}>
                      Milling & roasting · ₹4/kg
                    </td>
                    <td className="tnum py-1.5 text-right">{inr(res.mix.pricing.millingPaise)}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-ink-500" colSpan={3}>
                      3-layer pouch · flat
                    </td>
                    <td className="tnum py-1.5 text-right">{inr(res.mix.pricing.packagingPaise)}</td>
                  </tr>
                  <tr className="border-t border-ivory-300">
                    <td className="py-2 text-ink-700" colSpan={3}>
                      Subtotal · GST-inclusive 5%
                    </td>
                    <td className="tnum py-2 text-right font-bold text-ink-900">
                      {inr(res.mix.pricing.subtotalPaise)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 text-[11px] text-ink-400" colSpan={3}>
                      of which CGST {inr(res.mix.pricing.cgstPaise)} + SGST {inr(res.mix.pricing.sgstPaise)} · HSN
                      11010000
                    </td>
                    <td className="tnum py-1 text-right text-[11px] text-ink-400">{inr(res.mix.pricing.gstPaise)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="mt-3 flex items-baseline justify-between border-t border-gold-300 pt-3">
                <span className="font-display text-lg font-semibold text-ink-900">This pack</span>
                <span className="tnum font-display text-2xl font-bold text-ink-900">
                  {inr(res.mix.pricing.totalPaise)}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-ink-400">
                + {inr(res.mix.pricing.deliveryPaise)} delivery per order, added at checkout. COD or UPI QR.
              </div>

              <div className="gold-rule my-4" />
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-gold-700">
                Nutrition per 100 g · estimated
              </div>
              <table className="mt-2 w-full text-[13px]">
                <tbody>
                  {NUTR.map(([code, label, unit]) => {
                    const n = res.mix.nutrition.per100g.find((x) => x.code === code);
                    if (!n) return null;
                    return (
                      <tr key={code} className="border-b border-ivory-100">
                        <td className="py-1 text-ink-700">{label}</td>
                        <td className="tnum py-1 text-right font-semibold text-ink-900">
                          {(n.valueScaled / 100).toFixed(2)}
                        </td>
                        <td className="py-1 pl-1 text-[11px] text-ink-400">{unit}</td>
                        <td className="py-1 text-right text-[10px] font-bold text-gold-600">{n.sources.join(' + ')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-3 text-[11px] leading-5 text-ink-400">{res.notice}</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
