import { getStorefront } from '@/server/storefront-data';

export const dynamic = 'force-dynamic';

const FEATURED = ['everyday-atta', 'sugar-care-atta', 'high-protein-atta'];

const TRUST = ['Kanpur-milled, every week', 'COD + UPI QR, no gateway', 'Own drivers, own bags'];

export default async function Home() {
  const { preMades } = await getStorefront();
  const featured = FEATURED.map((s) => preMades.find((p) => p.slug === s)).filter((p) => p !== undefined);

  return (
    <main>
      {/* HERO — two-column structure: copy stack left, framed visual right.
          No text ever sits on the photograph (ui-ux-pro-max: overlay contrast). */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-16">
        <div className="space-y-6">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-forest-700">
            Kanpur · milled weekly · delivered by our own drivers
          </div>
          <h1 className="font-display text-4xl font-semibold leading-[1.08] tracking-tight text-ink-900 sm:text-5xl">
            Flour you can read, line by line.
          </h1>
          <p className="font-hindi text-lg text-ink-500">रोटी में स्वाद, स्वास्थ्य के साथ</p>
          <p className="max-w-md text-base leading-7 text-ink-700">
            Every blend shows its exact grain percentages, its full price breakdown and its estimated nutrition —
            because transparency is not a campaign, it is the recipe.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <a
              href="/lab"
              className="rounded-ctrl bg-forest-800 px-6 py-3 text-sm font-bold text-gold-100 shadow-warm transition hover:bg-forest-700"
            >
              Build my atta
            </a>
            <a
              href="/shop"
              className="rounded-ctrl border border-gold-500 px-6 py-3 text-sm font-bold text-gold-700 transition hover:bg-gold-100"
            >
              Shop the blends
            </a>
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
            {TRUST.map((t) => (
              <li key={t} className="flex items-center gap-2 text-xs font-semibold text-ink-500">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-forest-600" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="overflow-hidden rounded-card border border-ivory-300 shadow-warm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/img/hero-grains.png"
            alt="Brass bowls of whole grains and fresh-milled flour on ivory linen"
            className="aspect-[4/3] w-full object-cover"
          />
        </div>
      </section>

      {/* VALUE BAND — three numbered columns with dividers, one dark moment */}
      <section id="promise" className="bg-forest-950">
        <div className="mx-auto grid max-w-6xl divide-y divide-forest-800 px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6">
          {[
            [
              '01',
              'Our own drivers',
              'No courier roulette. Fresh packs travel in our bags, with people we employ and train.',
            ],
            [
              '02',
              'COD & UPI QR — no middleman',
              'Pay cash on delivery or scan our QR. Your money reaches our account directly, never a gateway.',
            ],
            [
              '03',
              'The receipt is the recipe',
              'Exact percentages, every fee on its own line, GST split shown. Estimated nutrition, labelled so.',
            ],
          ].map(([n, title, body]) => (
            <div key={n} className="space-y-3 px-0 py-10 sm:px-8 sm:first:pl-0 sm:last:pr-0">
              <div className="font-display text-2xl text-gold-300">{n}</div>
              <div className="text-base font-bold text-ivory-50">{title}</div>
              <p className="text-sm leading-6 text-forest-100/80">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* BLENDS — standard section header + uniform card anatomy */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-forest-700">The house blends</div>
            <h2 className="font-display text-3xl font-semibold text-ink-900">
              Premade, and proud of their percentages
            </h2>
          </div>
          <a href="/shop" className="text-sm font-bold text-forest-700 hover:underline">
            All five →
          </a>
        </div>
        <div className="gold-rule mt-6" />
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {featured.map((p) => (
            <a
              key={p.slug}
              href={`/shop/${p.slug}`}
              className="group flex flex-col overflow-hidden rounded-card border border-ivory-300 bg-white shadow-warm transition hover:border-gold-400 hover:shadow-lg"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.img} alt={p.name} className="aspect-[4/3] w-full object-cover" />
              <div className="flex flex-1 flex-col gap-4 p-6">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-gold-600">
                    Premade · 10 kg
                  </span>
                  {p.provisional && (
                    <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[10px] font-bold text-warn">
                      indicative
                    </span>
                  )}
                </div>
                <h3 className="font-display text-xl font-semibold text-ink-900">{p.name}</h3>
                <ul className="space-y-1.5 text-sm text-ink-500">
                  {p.lines.slice(0, 3).map((l) => (
                    <li key={l.name} className="flex justify-between gap-4">
                      <span className="truncate">{l.name}</span>
                      <span className="tnum shrink-0 font-semibold text-ink-700">{(l.bps / 100).toFixed(1)}%</span>
                    </li>
                  ))}
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
      </section>

      {/* LAB CTA — the single forest call-to-action band */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-20">
        <div className="grid items-center gap-8 rounded-card bg-forest-900 p-8 sm:p-12 lg:grid-cols-[1fr_auto]">
          <div className="space-y-4">
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-forest-100/70">The Lab</div>
            <h2 className="font-display text-3xl font-semibold text-gold-200">
              Don&rsquo;t like our recipe? Write your own.
            </h2>
            <p className="max-w-lg text-base leading-7 text-forest-100/85">
              Eighteen ingredients, your grams, our guardrails. Watch the price build rupee by rupee and the nutrition
              table fill in as you slide — then order exactly that.
            </p>
          </div>
          <a
            href="/lab"
            className="justify-self-start rounded-ctrl bg-gold-300 px-8 py-4 text-sm font-extrabold text-forest-950 shadow-warm transition hover:bg-gold-200 lg:justify-self-end"
          >
            Open the Lab →
          </a>
        </div>
      </section>
    </main>
  );
}
