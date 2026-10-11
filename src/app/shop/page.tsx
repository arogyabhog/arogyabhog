import { getStorefront } from '@/server/storefront-data';

export const dynamic = 'force-dynamic';

export default async function ShopPage() {
  const { preMades } = await getStorefront();
  return (
    <main className="mx-auto max-w-6xl px-4 pt-10 sm:px-5 sm:pt-12">
      <div className="text-xs font-bold uppercase tracking-[0.14em] text-forest-700">Shop</div>
      <h1 className="mt-2 font-display text-3xl font-semibold text-ink-900 sm:text-4xl">The house blends</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-7 text-ink-500">
        Five premade attas, each disclosing its exact composition. Prices are GST-inclusive; delivery (₹50/order) and
        any custom-mix milling charges appear separately at checkout.
      </p>
      <div className="gold-rule mt-4 mb-8" />
      <div className="grid grid-cols-1 gap-5 pb-8 md:grid-cols-2 lg:grid-cols-3">
        {preMades.map((p) => (
          <a
            key={p.slug}
            href={`/shop/${p.slug}`}
            className="group overflow-hidden rounded-card border border-ivory-300 bg-white shadow-warm transition hover:border-forest-600"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.img}
              alt={p.name}
              className="aspect-[4/3] w-full object-cover transition group-hover:scale-[1.02]"
            />
            <div className="p-5">
              <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-gold-600">Premade · 10 kg</div>
              <h2 className="mt-1 font-display text-xl font-semibold text-ink-900">{p.name}</h2>
              <ul className="mt-3 space-y-1 text-[13px] text-ink-500">
                {p.lines.slice(0, 4).map((l) => (
                  <li key={l.name} className="flex justify-between">
                    <span>{l.name}</span>
                    <span className="tnum font-semibold text-ink-700">{(l.bps / 100).toFixed(1)}%</span>
                  </li>
                ))}
                {p.lines.length > 4 && (
                  <li className="text-ink-400">+ {p.lines.length - 4} more — full list on the page</li>
                )}
              </ul>
              <div className="mt-4 flex items-baseline justify-between">
                <div className="tnum text-xl font-extrabold text-ink-900">
                  ₹{(p.sellPaise / 100).toLocaleString('en-IN')}
                  <span className="ml-1 text-xs font-medium text-ink-400">/ 10 kg</span>
                </div>
                {p.provisional && (
                  <span className="rounded-full bg-warn-soft px-2 py-1 text-[10px] font-bold text-warn">
                    indicative
                  </span>
                )}
              </div>
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}
