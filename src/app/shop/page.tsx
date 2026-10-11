import { getStorefront } from '@/server/storefront-data';

export const dynamic = 'force-dynamic';

export default async function ShopPage() {
  const { preMades } = await getStorefront();
  return (
    <main className="mx-auto max-w-6xl px-4 pt-12 sm:px-6 sm:pt-16">
      <div className="space-y-2">
        <div className="text-xs font-bold uppercase tracking-[0.14em] text-forest-700">Shop</div>
        <h1 className="font-display text-3xl font-semibold text-ink-900 sm:text-4xl">The house blends</h1>
        <p className="max-w-2xl text-base leading-7 text-ink-700">
          Five premade attas, each disclosing its exact composition. Prices are GST-inclusive; delivery (₹50/order) and
          any custom-mix milling charges appear separately at checkout.
        </p>
      </div>
      <div className="gold-rule mt-6" />
      <div className="mt-8 grid grid-cols-1 gap-6 pb-16 md:grid-cols-2 lg:grid-cols-3 sm:pb-20">
        {preMades.map((p) => (
          <a
            key={p.slug}
            href={`/shop/${p.slug}`}
            className="group flex flex-col overflow-hidden rounded-card border border-ivory-300 bg-white shadow-warm transition hover:border-gold-400 hover:shadow-lg"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.img} alt={p.name} className="aspect-[4/3] w-full object-cover" />
            <div className="flex flex-1 flex-col gap-4 p-6">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-gold-600">Premade · 10 kg</span>
                {p.provisional && (
                  <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[10px] font-bold text-warn">
                    indicative
                  </span>
                )}
              </div>
              <h2 className="font-display text-xl font-semibold text-ink-900">{p.name}</h2>
              <ul className="space-y-1.5 text-sm text-ink-500">
                {p.lines.slice(0, 4).map((l) => (
                  <li key={l.name} className="flex justify-between gap-4">
                    <span className="truncate">{l.name}</span>
                    <span className="tnum shrink-0 font-semibold text-ink-700">{(l.bps / 100).toFixed(1)}%</span>
                  </li>
                ))}
                {p.lines.length > 4 && <li className="text-ink-500">+ {p.lines.length - 4} more on the page</li>}
              </ul>
              <div className="mt-auto flex items-baseline justify-between border-t border-ivory-200 pt-4">
                <span className="tnum text-lg font-extrabold text-ink-900">
                  ₹{(p.sellPaise / 100).toLocaleString('en-IN')}
                  <span className="ml-1 text-xs font-medium text-ink-500">/ 10 kg</span>
                </span>
                <span className="text-sm font-bold text-forest-700 group-hover:underline">Details →</span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}
