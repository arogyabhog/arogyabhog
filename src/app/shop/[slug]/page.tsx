import { notFound } from 'next/navigation';
import { getPreMade } from '@/server/storefront-data';

export const dynamic = 'force-dynamic';

/** Composition-led copy. Deliberately NO disease/glycaemic claims — FSSAI
 *  Reg 10(1) + research lesson L8: we describe the recipe, not cures. */
const COPY: Record<string, string> = {
  'everyday-atta':
    'The house blend. Sharbati wheat carries the dough; barley, jowar and two dals round it out. The everyday rotli, made more interesting.',
  'sugar-care-atta':
    'A fibre-forward everyday rotli: barley and bajra slow the mill, kala chana and moong add body, chia and a measured 3% psyllium husk add soluble fibre.',
  'thyro-care-atta':
    'Our most seed-dense blend — sesame, pumpkin and sunflower seeds with linseed and kuttu (buckwheat), on a Sharbati wheat base.',
  'high-protein-atta':
    'Built around protein density: soya, moong dal and kala chana beside the wheat, finished with chia.',
  'vitality-atta': 'The festive blend — til, alsi, pumpkin, sunflower and a whisper of methi for aroma.',
};

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getPreMade(slug);
  if (!p) notFound();

  return (
    <main className="mx-auto max-w-6xl px-5 pt-10">
      <a href="/shop" className="text-sm font-bold text-gold-700 hover:underline">
        ← All blends
      </a>
      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <div className="overflow-hidden rounded-card border border-ivory-300 bg-white shadow-warm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.img} alt={p.name} className="w-full object-cover" />
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-gold-600">Premade · 10 kg pouch</div>
          <h1 className="mt-1 font-display text-4xl font-semibold leading-tight text-ink-900">{p.name}</h1>
          <p className="mt-4 text-[15px] leading-7 text-ink-700">{COPY[p.slug] ?? ''}</p>

          <div className="mt-6 flex items-baseline gap-3">
            <span className="tnum font-display text-3xl font-bold text-ink-900">
              ₹{(p.sellPaise / 100).toLocaleString('en-IN')}
            </span>
            <span className="text-sm text-ink-400">
              GST-inclusive · ₹{(p.sellPaise / 10 / 100).toLocaleString('en-IN')}/kg
            </span>
            {p.provisional && (
              <span className="rounded-full bg-warn-soft px-2 py-1 text-[10px] font-bold text-warn">
                indicative pricing
              </span>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-ctrl bg-ink-900 px-6 py-3 text-sm font-bold text-gold-300 shadow-warm hover:bg-ink-800"
            >
              Order · COD / UPI QR
            </button>
            <a
              href={`/lab?template=${p.slug}`}
              className="rounded-ctrl border border-gold-500 px-6 py-3 text-sm font-bold text-gold-700 hover:bg-gold-100"
            >
              Tweak this recipe in the Lab →
            </a>
          </div>
          <p className="mt-2 text-[11px] text-ink-400">
            Checkout opens in the next release — the button is honest about that.
          </p>
        </div>
      </div>

      {/* EXACT COMPOSITION — the whole table, not a teaser (lesson L1) */}
      <section className="mt-14 grid gap-10 pb-10 lg:grid-cols-2">
        <div className="rounded-card border border-gold-400 bg-white p-6 shadow-warm">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-gold-700">
            Exact composition · per 10 kg
          </div>
          <div className="gold-rule my-3" />
          <table className="w-full text-sm">
            <tbody>
              {p.lines.map((l) => (
                <tr key={l.name} className="border-b border-ivory-100">
                  <td className="py-2 text-ink-700">{l.name}</td>
                  <td className="tnum py-2 text-right font-bold text-ink-900">{(l.bps / 100).toFixed(2)}%</td>
                  <td className="tnum py-2 pl-4 text-right text-ink-400">{l.bps.toLocaleString('en-IN')} g</td>
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
        <div className="text-[13px] leading-6 text-ink-500">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-gold-700">House notes</div>
          <div className="gold-rule my-3" />
          <p>
            Milled to order each week from whole grains sourced in Kanpur mandis. Stone-fresh means no shelf stabilisers
            — we recommend finishing a pouch within 60 days.
          </p>
          <p className="mt-3">
            Nutrition for this blend will be published once lab analysis lands (estimated values from composition tables
            already power the Lab). Prices include 5% GST (HSN 11010000); delivery is ₹50 per order, waived with a
            referral credit.
          </p>
          <p className="mt-3">
            No returns, by design — we would rather mill it right the first time. If a pack reaches you damaged, talk to
            us and we will make it right.
          </p>
        </div>
      </section>
    </main>
  );
}
