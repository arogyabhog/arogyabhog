'use client';

/** Pack-size selector with live price (ADR-029: quantity is the only choice
 *  on locked products). Server renders the default; clicks stay client-side. */
import { useState } from 'react';

export function PackPicker({ packs }: { packs: Array<{ g: number; sellPaise: number; provisional: boolean }> }) {
  const fallback = packs[0];
  if (!fallback) return null;
  const initial = packs.find((p) => p.g === (packs.some((x) => x.g === 10000) ? 10000 : fallback.g)) ?? fallback;
  const [sel, setSel] = useState(initial.g);
  const cur = packs.find((p) => p.g === sel) ?? initial;
  if (!cur) return null;
  const kg = cur.g / 1000;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500">Pack size</span>
        {packs.map((p) => (
          <button
            key={p.g}
            type="button"
            onClick={() => setSel(p.g)}
            className={`rounded-ctrl px-3 py-1.5 text-xs font-bold transition ${
              sel === p.g
                ? 'bg-forest-700 text-forest-50'
                : 'border border-ivory-300 text-ink-500 hover:border-forest-600'
            }`}
          >
            {p.g / 1000} kg
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="tnum font-display text-3xl font-bold text-ink-900">
          ₹{(cur.sellPaise / 100).toLocaleString('en-IN')}
        </span>
        <span className="text-sm text-ink-500">
          GST-inclusive · ₹{(cur.sellPaise / kg / 100).toLocaleString('en-IN')}/kg
        </span>
      </div>
    </div>
  );
}
