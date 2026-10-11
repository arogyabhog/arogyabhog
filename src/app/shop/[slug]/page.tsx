import { notFound } from 'next/navigation';
import { PackPicker } from '@/components/PackPicker';
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
    <main className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 sm:pt-14">
      <a href="/shop" className="text-sm font-bold text-forest-700 hover:underline">
        ← All blends
      </a>

      {/* TOP: framed visual left, structured copy stack right */}
      <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-14">
        <div className="self-start overflow-hidden rounded-card border border-ivory-300 bg-white shadow-warm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.img} alt={p.name} className="aspect-[4/5] w-full object-cover sm:aspect-[4/3] lg:aspect-[4/5]" />
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-forest-700">
              Premade · 10 kg pouch
            </div>
            <h1 className="font-display text-3xl font-semibold leading-tight text-ink-900 sm:text-4xl">{p.name}</h1>
            <p className="text-base leading-7 text-ink-700">{COPY[p.slug] ?? p.desc ?? ''}</p>
          </div>

          <div className="space-y-3 border-y border-ivory-300 py-5">
            <PackPicker packs={p.packs} />
            {p.provisional && (
              <span className="inline-block rounded-full bg-warn-soft px-2.5 py-1 text-[10px] font-bold text-warn">
                indicative pricing — client review pending
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-ctrl bg-forest-800 px-6 py-3 text-sm font-bold text-gold-100 shadow-warm transition hover:bg-forest-700"
            >
              Order · COD / UPI QR
            </button>
            <a
              href="/lab"
              className="rounded-ctrl border border-forest-600 px-6 py-3 text-sm font-bold text-forest-700 transition hover:bg-forest-50"
            >
              {p.kind === 'premade' ? 'Make your own mix in the Lab →' : 'Build a custom mix in the Lab →'}
            </a>
          </div>
          <p className="text-xs text-ink-500">Checkout opens in the next release — the button is honest about that.</p>

          {(BENEFITS[p.slug] ?? []).length > 0 && (
            <div className="space-y-3 rounded-card border border-forest-100 bg-forest-50 p-6">
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-forest-800">Why this blend</div>
              <ul className="space-y-2.5">
                {(BENEFITS[p.slug] ?? []).map((b) => (
                  <li key={b} className="flex gap-3 text-sm leading-6 text-ink-700">
                    <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-600" />
                    {b}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-forest-800/80">
                We describe what is in the bag — the numbers below do the convincing. No health claims, by policy.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* TABLES: consistent section header, equal card anatomy, breathing rows */}
      <section className="mt-16 sm:mt-20">
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-forest-700">In the bag</div>
          <h2 className="font-display text-2xl font-semibold text-ink-900 sm:text-3xl">
            What it is made of — and what you get
          </h2>
        </div>
        <div className="gold-rule mt-6" />

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div className="overflow-hidden rounded-card border border-ivory-300 bg-white shadow-warm">
            <div className="bg-forest-900 px-6 py-3.5 text-[11px] font-bold uppercase tracking-[0.12em] text-gold-200">
              Exact composition · per 1 kg
            </div>
            <div className="overflow-x-auto p-6">
              <table className="w-full min-w-[320px] text-sm">
                <tbody>
                  {p.lines.map((l) => (
                    <tr key={l.name} className="border-b border-ivory-200">
                      <td className="py-2.5 pr-2 text-ink-700">{l.name}</td>
                      <td className="tnum py-2.5 text-right font-bold text-ink-900">{(l.bps / 100).toFixed(2)}%</td>
                      <td className="tnum py-2.5 pl-4 text-right text-ink-500">
                        {(l.bps / 10).toLocaleString('en-IN')} g
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-3 font-bold text-ink-900">Total</td>
                    <td className="tnum py-3 text-right font-bold text-ink-900">100.00%</td>
                    <td className="tnum py-3 pl-4 text-right font-bold text-ink-900">1,000 g</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden rounded-card border border-ivory-300 bg-white shadow-warm">
            <div className="flex items-center justify-between gap-2 bg-forest-900 px-6 py-3.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-gold-200">
                What you get · nutrition
              </span>
              <span className="rounded-full bg-gold-200/15 px-2.5 py-0.5 text-[10px] font-bold text-gold-200">
                estimated
              </span>
            </div>
            <div className="overflow-x-auto p-6">
              <table className="w-full min-w-[340px] text-sm">
                <thead>
                  <tr className="border-b border-ivory-300 text-[11px] uppercase tracking-wide text-ink-500">
                    <th className="pb-2.5 text-left font-bold">Nutrient</th>
                    <th className="tnum pb-2.5 text-right font-bold">Per 100 g</th>
                    <th className="tnum pb-2.5 pl-4 text-right font-bold">Per 1 kg</th>
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
                          className="px-2 py-2 text-[11px] font-extrabold uppercase tracking-[0.1em] text-forest-800"
                        >
                          {GROUP_LABEL[group]}
                        </td>
                      </tr>,
                      ...rows.map((n) => (
                        <tr key={n.code} className="border-b border-ivory-200">
                          <td className="py-2.5 pr-2 text-ink-700">{n.label}</td>
                          <td className="tnum py-2.5 text-right font-semibold text-ink-900">
                            {formatAmount(n.per100g, n.unit)}
                          </td>
                          <td className="tnum py-2.5 pl-4 text-right text-ink-500">
                            {formatAmount(n.perPack, n.unit)}
                          </td>
                        </tr>
                      )),
                    ];
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-ivory-200 bg-ivory-100 px-6 py-4 text-xs leading-5 text-ink-500">
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
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-3xl space-y-3 pb-16 sm:mt-20 sm:pb-20">
        <div className="text-xs font-bold uppercase tracking-[0.14em] text-forest-700">House notes</div>
        <p className="text-sm leading-6 text-ink-700">
          Milled to order each week from whole grains sourced in Kanpur mandis. Stone-fresh means no shelf stabilisers —
          we recommend finishing a pouch within 60 days.
        </p>
        <p className="text-sm leading-6 text-ink-700">
          Prices include 5% GST (HSN 11010000); delivery is ₹50 per order, waived when you redeem a referral credit.
          Milling (₹4/kg) and packaging (₹5) apply to custom Lab blends and are always separate lines.
        </p>
        <p className="text-sm leading-6 text-ink-700">
          No returns, by design — we would rather mill it right the first time. If a pack reaches you damaged, talk to
          us and we will make it right.
        </p>
      </section>
    </main>
  );
}
