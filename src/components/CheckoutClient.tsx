'use client';

import { useEffect, useState } from 'react';
import { placeOrders } from '@/app/(storefront)/checkout/actions';
import { CART_EVENT, type CartLine, getCart, writeCart } from '@/lib/cart';

interface ProductRef {
  slug: string;
  name: string;
  packs: Array<{ g: number; sellPaise: number; provisional: boolean }>;
}

const inr = (p: number) => `₹${(p / 100).toLocaleString('en-IN')}`;

export function CheckoutClient({
  products,
  userName,
  failed,
  couponError,
}: {
  products: ProductRef[];
  userName: string;
  failed: boolean;
  couponError: string;
}) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [payment, setPayment] = useState<'COD' | 'UPI_QR'>('COD');
  useEffect(() => {
    const sync = () => setLines(getCart());
    sync();
    window.addEventListener(CART_EVENT, sync);
    return () => window.removeEventListener(CART_EVENT, sync);
  }, []);

  const enriched = lines
    .map((l) => {
      const product = products.find((p) => p.slug === l.slug);
      const pack = product?.packs.find((x) => x.g === l.packG);
      return product && pack ? { ...l, product, pack } : null;
    })
    .filter((x) => x !== null);
  const total = enriched.reduce((a, l) => a + l.pack.sellPaise * l.qty, 0);

  const setQty = (slug: string, packG: number, qty: number) => {
    const next = getCart()
      .map((l) => (l.slug === slug && l.packG === packG ? { ...l, qty: Math.max(0, qty) } : l))
      .filter((l) => l.qty > 0);
    writeCart(next);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 sm:pt-14">
      <div className="space-y-2">
        <div className="text-xs font-bold uppercase tracking-[0.14em] text-forest-700">Checkout</div>
        <h1 className="font-display text-3xl font-semibold text-ink-900">Your order</h1>
      </div>
      <div className="gold-rule mt-6" />

      {enriched.length === 0 ? (
        <div className="mt-10 space-y-4 rounded-card border border-ivory-300 bg-white p-10 text-center shadow-warm">
          <p className="text-base text-ink-700">Your cart is empty.</p>
          <a href="/shop" className="text-sm font-bold text-forest-700 hover:underline">
            Browse the shop →
          </a>
        </div>
      ) : (
        <form action={placeOrders} className="mt-8 grid gap-8 pb-16 lg:grid-cols-[1.2fr_1fr]">
          <input type="hidden" name="lines" value={JSON.stringify(lines)} />
          <div className="space-y-6">
            <div className="space-y-3 rounded-card border border-ivory-300 bg-white p-6 shadow-warm">
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-forest-700">In your cart</div>
              {enriched.map((l) => (
                <div
                  key={`${l.slug}-${l.packG}`}
                  className="flex flex-wrap items-center gap-3 border-b border-ivory-200 py-3 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-ink-900">{l.product.name}</div>
                    <div className="tnum text-xs text-ink-500">
                      {l.packG / 1000} kg · {inr(l.pack.sellPaise)} each
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQty(l.slug, l.packG, l.qty - 1)}
                      className="h-7 w-7 rounded-ctrl border border-ivory-300 text-sm font-bold text-ink-700 hover:border-forest-600"
                    >
                      −
                    </button>
                    <span className="tnum w-6 text-center text-sm font-bold text-ink-900">{l.qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty(l.slug, l.packG, l.qty + 1)}
                      className="h-7 w-7 rounded-ctrl border border-ivory-300 text-sm font-bold text-ink-700 hover:border-forest-600"
                    >
                      +
                    </button>
                  </div>
                  <div className="tnum w-24 text-right text-sm font-extrabold text-ink-900">
                    {inr(l.pack.sellPaise * l.qty)}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4 rounded-card border border-ivory-300 bg-white p-6 shadow-warm">
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-forest-700">Delivery details</div>
              <label className="block space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-[0.1em] text-ink-500">Name</span>
                <input
                  name="name"
                  defaultValue={userName}
                  required
                  className="w-full rounded-ctrl border border-ivory-300 bg-ivory-50 px-3 py-2.5 text-sm font-semibold text-ink-900 focus:border-forest-600 focus:outline-none"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-[0.1em] text-ink-500">Phone</span>
                  <input
                    name="phone"
                    required
                    minLength={10}
                    placeholder="10-digit mobile"
                    className="w-full rounded-ctrl border border-ivory-300 bg-ivory-50 px-3 py-2.5 text-sm font-semibold text-ink-900 focus:border-forest-600 focus:outline-none"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-[0.1em] text-ink-500">Pincode</span>
                  <input
                    name="pincode"
                    required
                    minLength={6}
                    className="w-full rounded-ctrl border border-ivory-300 bg-ivory-50 px-3 py-2.5 text-sm font-semibold text-ink-900 focus:border-forest-600 focus:outline-none"
                  />
                </label>
              </div>
              <label className="block space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-[0.1em] text-ink-500">Address</span>
                <textarea
                  name="address"
                  required
                  rows={3}
                  className="w-full rounded-ctrl border border-ivory-300 bg-ivory-50 px-3 py-2.5 text-sm font-semibold text-ink-900 focus:border-forest-600 focus:outline-none"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-[0.1em] text-ink-500">City</span>
                <input
                  name="city"
                  defaultValue="Kanpur"
                  required
                  className="w-full rounded-ctrl border border-ivory-300 bg-ivory-50 px-3 py-2.5 text-sm font-semibold text-ink-900 focus:border-forest-600 focus:outline-none"
                />
              </label>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-3 rounded-card border border-ivory-300 bg-white p-6 shadow-warm">
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-forest-700">Coupon</div>
              <label className="block space-y-1.5">
                <span className="text-sm font-bold text-ink-900">Offer code</span>
                <input
                  name="couponCode"
                  maxLength={32}
                  autoCapitalize="characters"
                  placeholder="Enter code (optional)"
                  className="w-full rounded-ctrl border border-ivory-300 bg-ivory-50 px-3 py-2.5 text-sm font-semibold uppercase text-ink-900 focus:border-forest-600 focus:outline-none"
                />
              </label>
              <p className="text-xs leading-5 text-ink-500">
                A coupon is validated at checkout and applied once to each cart line/order. Multiple lines create
                sibling orders and use one redemption per order; referral-credit stacking is not currently available.
              </p>
              {couponError && (
                <p role="alert" className="rounded-ctrl bg-danger-soft px-3 py-2 text-xs font-bold text-danger">
                  {couponError === 'NOT_FOUND'
                    ? 'Coupon not found for this store.'
                    : couponError === 'MINIMUM_NOT_MET'
                      ? 'The order minimum for this coupon is not met on every line.'
                      : couponError === 'USAGE_LIMIT' || couponError === 'USER_LIMIT'
                        ? 'This coupon has reached its usage limit.'
                        : 'This coupon is not currently valid. Check the code and try again.'}
                </p>
              )}
            </div>
            <div className="space-y-4 rounded-card border border-ivory-300 bg-white p-6 shadow-warm">
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-forest-700">Payment</div>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="radio"
                  name="payment"
                  value="COD"
                  checked={payment === 'COD'}
                  onChange={() => setPayment('COD')}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-bold text-ink-900">Cash on delivery</span>
                  <span className="block text-xs leading-5 text-ink-500">
                    Pay our driver in cash when the pack reaches you.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="radio"
                  name="payment"
                  value="UPI_QR"
                  checked={payment === 'UPI_QR'}
                  onChange={() => setPayment('UPI_QR')}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-bold text-ink-900">UPI QR — no gateway</span>
                  <span className="block text-xs leading-5 text-ink-500">
                    Scan our QR after placing; the money goes straight to our own bank account. We verify and confirm.
                  </span>
                </span>
              </label>
            </div>

            <div className="space-y-3 rounded-card border border-gold-400 bg-white p-6 shadow-warm">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold text-ink-700">Items</span>
                <span className="tnum text-sm font-extrabold text-ink-900">{inr(total)}</span>
              </div>
              <p className="text-xs leading-5 text-ink-500">
                GST-inclusive. Delivery ₹50/order and any Lab milling charges are added on the order page, exactly as
                promised — no surprises.
              </p>
              {failed && (
                <p className="rounded-ctrl bg-danger-soft px-3 py-2 text-xs font-bold text-danger">
                  Could not place the order — check phone and address, then try again.
                </p>
              )}
              <button
                type="submit"
                className="w-full rounded-ctrl bg-forest-800 px-6 py-3 text-sm font-bold text-gold-100 shadow-warm transition hover:bg-forest-700"
              >
                Place order · {inr(total)}
              </button>
            </div>
          </div>
        </form>
      )}
    </main>
  );
}
