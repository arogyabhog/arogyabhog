import { notFound } from 'next/navigation';
import { formatAmount, NUTRIENT_GROUP_ORDER } from '@/domain/nutrition-blend';
import { getPreMadeDetail } from '@/server/storefront-data';

export const dynamic = 'force-dynamic';

/** Composition-led copy. Deliberately NO disease/glycaemic claims — FSSAI
 *  Reg 10(1) + research lesson L8: we describe the recipe, not cures. */
const COPY: Record<string, string> = {
  'everyday-atta':
    'The house blend. Sharbati wheat carries the dough; kala chana and soybean add everyday protein, while barley, jowar, ragi and bajra keep the rotli soft. Finished with a touch of alsi.',
  'sugar-care-atta':
    'A fibre-forward everyday rotli: premium jau (barley) leads at 15%, with jowar, ragi, bajra and 3% alsi adding soluble fibre, while kala chana and soybean round out the body.',
  'thyro-care-atta':
    'Our wheat-free blend — kuttu (buckwheat) at 40% with jowar, moong dal for softness, ragi for calcium, and chia plus alsi for omega-3. Milled where wheat is also handled.',
  'high-protein-atta':
    'Built around protein density: soya at 15% and premium kala chana at 12% beside the wheat, with barley for softness, alsi, and a measured 2% psyllium husk for soluble fibre.',
  'vitality-atta':
    'The festive blend — pumpkin, til, sunflower and alsi seeds over a base of wheat, kala chana, jau and ragi, with a whisper of methi for aroma.',
};

/** Benefit lines: what the recipe contains + general nutrient roles only.
 *  No organ/disease claims — the numbers table below does the convincing. */
const BENEFITS: Record<string, string[]> = {
  'everyday-atta': [
    'Five grains and two protein sources keep the everyday rotli interesting — and familiar enough for the whole table.',
    'Barley, jowar, ragi and bajra bring whole-grain fibre that keeps meals satisfying longer.',
    'Milled fresh each week — the aroma store-shelf flour loses before you ever open it.',
  ],
  'sugar-care-atta': [
    'Naturally fibre-forward: 15% barley with jowar, ragi, bajra and 3% alsi bring soluble fibre, which supports steady digestion.',
    'Kala chana and soybean add plant protein alongside the fibre.',
    'Nothing added to "balance sugar" — the recipe itself is the point, and every gram of it is disclosed above.',
  ],
  'thyro-care-atta': [
    'Kuttu (buckwheat) leads at 40% — a wheat-free rotation with a naturally rich magnesium profile.',
    'Chia and alsi contribute omega-3 (ALA), rare in an atta.',
    'Moong dal keeps the rotli soft; ragi adds calcium.',
  ],
  'high-protein-atta': [
    'Soya (15%) and premium kala chana (12%) lift the protein per roti — useful in active households and vegetarian kitchens.',
    'Protein supports muscle repair and keeps you satisfied longer.',
    'Barley and a measured 2% psyllium husk add soluble fibre.',
  ],
  'vitality-atta': [
    'Four seeds — pumpkin, til, sunflower, alsi — for calcium, iron, zinc and healthy fats.',
    'Ragi and kala chana deepen the mineral profile beyond everyday wheat.',
    'Methi lends its classic aroma and a touch of bitterness that pairs with ghee.',
  ],
};

const GROUP_LABEL: Record<string, string> = {
  macronutrients: 'Macronutrients',
  minerals: 'Minerals',
  vitamins: 'Vitamins',
};

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = await getPreMadeDetail(slug);
  if (!detail) notFound();
  const { premade: p, nutrition, minCoverageBps, missingIngredients, sources } = detail;
  const partial = minCoverageBps < 10000;

  return (
    <main className="mx-auto max-w-6xl px-4 pt-8 sm:px-5 sm:pt-10">
      <a href="/shop" className="text-sm font-bold text-forest-700 hover:underline">
        ← All blends
      </a>

      <div className="mt-5 grid gap-8 lg:grid-cols-2 lg:gap-10">
        <div className="overflow-hidden rounded-card border border-ivory-300 bg-white shadow-warm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.img} alt={p.name} className="w-full object-cover" />
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-forest-700">Premade · 10 kg pouch</div>
          <h1 className="mt-1 font-display text-3xl font-semibold leading-tight text-ink-900 sm:text-4xl">{p.name}</h1>
          <p className="mt-4 text-[15px] leading-7 text-ink-700">{COPY[p.slug] ?? ''}</p>

          <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="tnum font-display text-3xl font-bold text-ink-900">
              ₹{(p.sellPaise / 100).toLocaleString('en-IN')}
            </span>
            <span className="text-sm text-ink-500">
              GST-inclusive · ₹{(p.sellPaise / 10 / 100).toLocaleString('en-IN')}/kg
            </span>
            {p.provisional && (
              <span className="rounded-full bg-warn-soft px-2 py-1 text-[10px] font-bold text-warn">
                indicative pricing
              </span>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-ctrl bg-forest-800 px-6 py-3 text-sm font-bold text-gold-100 shadow-warm hover:bg-forest-700"
            >
              Order · COD / UPI QR
            </button>
            <a
              href={`/lab?template=${p.slug}`}
              className="rounded-ctrl border border-forest-600 px-6 py-3 text-sm font-bold text-forest-700 hover:bg-forest-50"
            >
              Tweak this recipe in the Lab →
            </a>
          </div>
          <p className="mt-2 text-[11px] text-ink-500">
            Checkout opens in the next release — the button is honest about that.
          </p>

          {/* BENEFIT LINES — composition + general nutrient roles, zero claims */}
          {(BENEFITS[p.slug] ?? []).length > 0 && (
            <div className="mt-6 rounded-card border border-forest-100 bg-forest-50 p-5">
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-forest-800">Why this blend</div>
              <ul className="mt-3 space-y-2">
                {(BENEFITS[p.slug] ?? []).map((b) => (
                  <li key={b} className="flex gap-2.5 text-[13.5px] leading-6 text-ink-700">
                    <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-600" />
                    {b}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-forest-800/70">
                We describe what is in the bag — the numbers below do the convincing. No health claims, by policy.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* THE TWO TABLES: what it IS, and what you GET */}
      <section className="mt-12 grid gap-8 pb-10 lg:grid-cols-2 lg:gap-10">
        <div className="overflow-hidden rounded-card border border-ivory-300 bg-white shadow-warm">
          <div className="bg-forest-900 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-gold-200">
            Exact composition · per 10 kg
          </div>
          <div className="overflow-x-auto p-5">
            <table className="w-full min-w-[320px] text-sm">
              <tbody>
                {p.lines.map((l) => (
                  <tr key={l.name} className="border-b border-ivory-100">
                    <td className="py-2 pr-2 text-ink-700">{l.name}</td>
                    <td className="tnum py-2 text-right font-bold text-ink-900">{(l.bps / 100).toFixed(2)}%</td>
                    <td className="tnum py-2 pl-4 text-right text-ink-500">{l.bps.toLocaleString('en-IN')} g</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-2 font-bold text-ink-900">Total</td>
                  <td className="tnum py-2 text-right font-bold text-ink-900">100.00%</td>
                  <td className="tnum py-2 pl-4 text-right font-bold text-ink-900">10,000 g</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-card border border-ivory-300 bg-white shadow-warm">
          <div className="flex items-center justify-between gap-2 bg-forest-900 px-5 py-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-gold-200">
              What you get · nutrition
            </span>
            <span className="rounded-full bg-gold-200/15 px-2 py-0.5 text-[10px] font-bold text-gold-200">
              estimated
            </span>
          </div>
          <div className="overflow-x-auto p-5">
            <table className="w-full min-w-[340px] text-[13px]">
              <thead>
                <tr className="border-b border-ivory-300 text-[11px] uppercase tracking-wide text-ink-500">
                  <th className="pb-2 text-left font-bold">Nutrient</th>
                  <th className="tnum pb-2 text-right font-bold">Per 100 g</th>
                  <th className="tnum pb-2 pl-4 text-right font-bold">Per 10 kg pack</th>
                </tr>
              </thead>
              <tbody>
                {NUTRIENT_GROUP_ORDER.map((group) => {
                  const rows = nutrition.filter((n) => n.group === group);
                  if (rows.length === 0) return null;
                  return [
                    <tr key={`${group}-head`} className="bg-forest-50">
                      <td
                        colSpan={3}
                        className="px-2 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.1em] text-forest-800"
                      >
                        {GROUP_LABEL[group]}
                      </td>
                    </tr>,
                    ...rows.map((n) => (
                      <tr key={n.code} className="border-b border-ivory-100">
                        <td className="py-1.5 pr-2 text-ink-700">{n.label}</td>
                        <td className="tnum py-1.5 text-right font-semibold text-ink-900">
                          {formatAmount(n.per100g, n.unit)}
                        </td>
                        <td className="tnum py-1.5 pl-4 text-right text-ink-500">{formatAmount(n.perPack, n.unit)}</td>
                      </tr>
                    )),
                  ];
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-ivory-200 px-5 py-4 text-[11px] leading-5 text-ink-500">
            Estimated from published composition tables ({sources.join(' + ')}) weighted by the exact recipe — never
            lab-analysed, and labelled so.
            {partial && (
              <>
                {' '}
                Figures cover <strong className="text-ink-700">{(minCoverageBps / 100).toFixed(1)}%</strong> of this
                blend by weight;{' '}
                {missingIngredients.map((m, i) => (
                  <span key={m.name}>
                    {i > 0 && ', '}
                    {m.name} ({(m.bps / 100).toFixed(1)}%)
                  </span>
                ))}{' '}
                has no published nutrition data yet — shown values are therefore a slight underestimate, not a guess.
              </>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto mb-10 max-w-3xl text-[13px] leading-6 text-ink-500">
        <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-forest-700">House notes</div>
        <div className="mt-2 space-y-3">
          <p>
            Milled to order each week from whole grains sourced in Kanpur mandis. Stone-fresh means no shelf stabilisers
            — we recommend finishing a pouch within 60 days.
          </p>
          <p>
            Prices include 5% GST (HSN 11010000); delivery is ₹50 per order, waived when you redeem a referral credit.
            Milling (₹4/kg) and packaging (₹5) apply to custom Lab blends and are always separate lines.
          </p>
          <p>
            No returns, by design — we would rather mill it right the first time. If a pack reaches you damaged, talk to
            us and we will make it right.
          </p>
        </div>
      </section>
    </main>
  );
}
