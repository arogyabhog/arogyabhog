import type { PreMadeProp } from '@/components/LabClient';

/** One card anatomy for every product kind (ui-ux-pro-max: uniform cards). */
export function ProductCard({ p }: { p: PreMadeProp }) {
  const first = p.packs[0];
  if (!first) return null;
  const display =
    p.kind === 'single' ? (p.packs.find((x) => x.g === 1000) ?? first) : (p.packs.find((x) => x.g === 10000) ?? first);
  const unit = p.kind === 'single' ? '/ kg' : '/ 10 kg';
  return (
    <a
      href={`/shop/${p.slug}`}
      className="group flex flex-col overflow-hidden rounded-card border border-ivory-300 bg-white shadow-warm transition hover:border-gold-400 hover:shadow-lg"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={p.img} alt={p.name} className="aspect-[4/3] w-full object-cover" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-gold-600">
            {p.kind === 'single' ? 'Single grain · milled whole' : 'Premade · house blend'}
          </span>
          {p.provisional && (
            <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[10px] font-bold text-warn">indicative</span>
          )}
        </div>
        <h3 className="font-display text-xl font-semibold text-ink-900">{p.name}</h3>
        {p.kind === 'premade' ? (
          <ul className="space-y-1.5 text-sm text-ink-500">
            {p.lines.slice(0, 3).map((l) => (
              <li key={l.name} className="flex justify-between gap-4">
                <span className="truncate">{l.name}</span>
                <span className="tnum shrink-0 font-semibold text-ink-700">{(l.bps / 100).toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-6 text-ink-500">{p.lines[0]?.name ?? 'Whole grain'} · 100%</p>
        )}
        <div className="mt-auto flex items-baseline justify-between border-t border-ivory-200 pt-4">
          <span className="tnum text-lg font-extrabold text-ink-900">
            ₹{(display.sellPaise / 100).toLocaleString('en-IN')}
            <span className="ml-1 text-xs font-medium text-ink-500">{unit}</span>
          </span>
          <span className="text-sm font-bold text-forest-700 group-hover:underline">Details →</span>
        </div>
      </div>
    </a>
  );
}
