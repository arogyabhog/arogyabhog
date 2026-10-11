import { desc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { attestPayment } from '@/app/(storefront)/orders/actions';
import { CartClearer } from '@/components/CartClearer';
import { db } from '@/db/client';
import { orderEvents, orders, products, stores } from '@/db/schema';
import { getCurrentUser } from '@/server/auth';

export const dynamic = 'force-dynamic';

const inr = (p: number) => `₹${(p / 100).toLocaleString('en-IN')}`;

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const order = await db.select().from(orders).where(eq(orders.id, id)).get();
  if (!order) notFound();
  // Owner or staff only (RBAC reaches order data too).
  if (!user || (order.userId !== user.id && user.role !== 'ADMIN' && user.role !== 'MANAGER')) notFound();

  const product = order.productId
    ? await db.select().from(products).where(eq(products.id, order.productId)).get()
    : null;
  const store = await db.select().from(stores).where(eq(stores.id, order.storeId)).get();
  const events = await db
    .select()
    .from(orderEvents)
    .where(eq(orderEvents.orderId, order.id))
    .orderBy(desc(orderEvents.at));
  const snapshot = JSON.parse(order.itemsSnapshot) as {
    lines?: Array<{ name: string; paise?: number; weightG?: number; ratioBps?: number }>;
  };

  let qrDataUrl: string | null = null;
  if (order.paymentMethod === 'UPI_QR' && order.paymentStatus === 'UNPAID' && store) {
    const uri = `upi://pay?pa=${encodeURIComponent(store.upiVpa)}&pn=${encodeURIComponent('ArogyaBhog')}&am=${(order.totalPaise / 100).toFixed(2)}&cu=INR&tn=${encodeURIComponent(order.id)}`;
    qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 sm:pt-14">
      <CartClearer />
      <a href="/orders" className="text-sm font-bold text-forest-700 hover:underline">
        ← All orders
      </a>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-forest-700">Order</div>
          <h1 className="tnum font-display text-2xl font-semibold text-ink-900 sm:text-3xl">{order.id}</h1>
          <p className="text-sm text-ink-500">Placed {new Date(order.placedAt).toLocaleString('en-IN')}</p>
        </div>
        <div className="flex gap-2">
          <span className="rounded-full bg-forest-50 px-3 py-1.5 text-[11px] font-bold text-forest-800">
            {order.fulfillmentStatus}
          </span>
          <span className="rounded-full bg-gold-100 px-3 py-1.5 text-[11px] font-bold text-gold-700">
            {order.paymentStatus}
          </span>
        </div>
      </div>
      <div className="gold-rule mt-6" />

      <div className="mt-8 grid gap-8 pb-16 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <div className="space-y-3 rounded-card border border-ivory-300 bg-white p-6 shadow-warm">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-forest-700">What you ordered</div>
            <div className="text-sm font-bold text-ink-900">
              {product?.name ?? 'Custom Lab mix'} · {(order.packSizeG * order.packageCount) / 1000} kg
            </div>
            <ul className="space-y-1.5 text-sm text-ink-500">
              {(snapshot.lines ?? []).map((l) => (
                <li key={l.name} className="flex justify-between gap-4">
                  <span className="truncate">{l.name}</span>
                  <span className="tnum shrink-0 font-semibold text-ink-700">
                    {l.ratioBps !== undefined ? `${(l.ratioBps / 100).toFixed(2)}%` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2 rounded-card border border-ivory-300 bg-white p-6 shadow-warm">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-forest-700">The full receipt</div>
            {(
              [
                ['Raw material / product', order.rawPaise],
                ['Milling & roasting', order.millingPaise],
                ['Packaging', order.packagingPaise],
                ['Subtotal (GST-inclusive)', order.subtotalPaise],
                [`CGST ${(order.gstRateBps / 200).toFixed(1)}%`, order.cgstPaise],
                [`SGST ${(order.gstRateBps / 200).toFixed(1)}%`, order.sgstPaise],
                ['Delivery', order.deliveryPaise],
              ] as const
            ).map(([label, paise]) => (
              <div key={label} className="flex justify-between border-b border-ivory-100 py-1.5 text-sm last:border-0">
                <span className="text-ink-500">{label}</span>
                <span className="tnum font-semibold text-ink-900">{inr(paise)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 text-base font-extrabold text-ink-900">
              <span>Total</span>
              <span className="tnum">{inr(order.totalPaise)}</span>
            </div>
            {order.deliveryWaived && <p className="text-xs text-leaf">Delivery waived via referral credit 🎉</p>}
          </div>

          <div className="space-y-3 rounded-card border border-ivory-300 bg-white p-6 shadow-warm">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-forest-700">Timeline</div>
            <ul className="space-y-2">
              {events.map((e) => (
                <li key={e.id} className="flex flex-wrap gap-2 text-xs text-ink-500">
                  <span className="tnum">{new Date(e.at).toLocaleString('en-IN')}</span>
                  <span className="font-bold text-ink-700">
                    {e.action}: {e.fromStatus ?? '—'} → {e.toStatus ?? '—'}
                  </span>
                  {e.note && <span className="text-ink-500">({e.note})</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2 rounded-card border border-ivory-300 bg-white p-6 shadow-warm">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-forest-700">Deliver to</div>
            <p className="text-sm leading-6 text-ink-700">
              {order.customerName} · {order.customerPhone}
              <br />
              {order.addressLine}, {order.city} — {order.pincode}
            </p>
          </div>

          {qrDataUrl && (
            <div className="space-y-4 rounded-card border border-gold-400 bg-white p-6 text-center shadow-warm">
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-gold-600">Scan & pay · UPI</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt={`UPI QR for ${order.id}`} className="mx-auto h-[220px] w-[220px]" />
              <p className="text-xs leading-5 text-ink-500">
                Pays <strong>{store?.upiVpa}</strong> — our own bank account, no gateway. After paying, attest below; we
                verify and confirm before milling.
              </p>
              <form action={attestPayment}>
                <input type="hidden" name="orderId" value={order.id} />
                <button
                  type="submit"
                  className="w-full rounded-ctrl bg-forest-800 px-6 py-3 text-sm font-bold text-gold-100 shadow-warm transition hover:bg-forest-700"
                >
                  I have paid · attest
                </button>
              </form>
            </div>
          )}
          {order.paymentMethod === 'UPI_QR' && order.paymentStatus === 'AWAITING_VERIFICATION' && (
            <div className="rounded-card border border-forest-100 bg-forest-50 p-6 text-sm leading-6 text-ink-700">
              Payment attested — waiting for our verification. We confirm against our bank statement before milling.
            </div>
          )}
          {order.paymentMethod === 'COD' && (
            <div className="rounded-card border border-forest-100 bg-forest-50 p-6 text-sm leading-6 text-ink-700">
              Cash on delivery: pay our driver in cash when the pack reaches you. Exact change helps, any amount works.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
