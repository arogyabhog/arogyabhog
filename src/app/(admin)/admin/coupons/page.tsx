import { and, asc, count, eq, ne } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { couponRedemptions, coupons, orders, stores } from '@/db/schema';
import { getCurrentUser } from '@/server/auth';
import { createCoupon, setCouponActive, updateCoupon } from './actions';

export const dynamic = 'force-dynamic';
const field = 'mt-1 w-full rounded-ctrl border border-ivory-300 bg-white px-3 py-2 text-sm';
const label = 'block text-xs font-semibold text-ink-700';
const button = 'rounded-ctrl bg-forest-700 px-3 py-2 text-sm font-semibold text-white hover:bg-forest-800';
const notices: Record<string, string> = {
  created: 'Coupon created.',
  updated: 'Coupon updated.',
  activated: 'Coupon activated.',
  deactivated: 'Coupon deactivated.',
  invalid: 'Check the coupon fields and try again.',
  unavailable: 'That store or coupon is not available to your account.',
  duplicate: 'A coupon with that code already exists for this store.',
  locked: 'Coupon terms are locked after a non-cancelled redemption; deactivate it instead.',
};
const dateInput = (epoch: number | null) => (epoch === null ? '' : new Date(epoch).toISOString().slice(0, 10));
const money = (paise: number | null) => (paise === null ? '' : (paise / 100).toFixed(2));

function CouponFields({
  coupon,
  storeId,
  role,
}: {
  coupon?: typeof coupons.$inferSelect;
  storeId: string;
  role: string;
}) {
  return (
    <>
      <input type="hidden" name="storeId" value={storeId} />
      {coupon && <input type="hidden" name="couponId" value={coupon.id} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={label}>
          Code
          <input
            className={field}
            name="code"
            required
            maxLength={32}
            defaultValue={coupon?.code}
            placeholder="WELCOME10"
          />
        </label>
        <label className={label}>
          Offer type
          <select className={field} name="type" defaultValue={coupon?.type ?? 'PERCENT'}>
            <option value="PERCENT">Percent off</option>
            <option value="FLAT">Flat amount</option>
            <option value="FREE_DELIVERY">Free delivery</option>
          </select>
        </label>
        <label className={label}>
          Percent (basis points)
          <input
            className={field}
            name="valueBps"
            inputMode="numeric"
            defaultValue={coupon?.type === 'PERCENT' ? coupon.value : coupon?.type === 'FREE_DELIVERY' ? 0 : 1000}
          />
          <span className="mt-1 block font-normal">1,000 = 10%. {role === 'MANAGER' ? 'Manager max: 5,000.' : ''}</span>
        </label>
        <label className={label}>
          Flat offer (₹)
          <input
            className={field}
            name="valueRupees"
            inputMode="decimal"
            defaultValue={coupon?.type === 'FLAT' ? money(coupon.value) : '0.00'}
          />
        </label>
        <label className={label}>
          Minimum item subtotal (₹)
          <input
            className={field}
            name="minOrderRupees"
            inputMode="decimal"
            defaultValue={money(coupon?.minOrderPaise ?? null)}
          />
        </label>
        <label className={label}>
          Maximum item discount (₹)
          <input
            className={field}
            name="maxDiscountRupees"
            inputMode="decimal"
            defaultValue={money(coupon?.maxDiscountPaise ?? null)}
          />
        </label>
        <label className={label}>
          Total uses (blank = unlimited)
          <input className={field} name="usageLimit" inputMode="numeric" defaultValue={coupon?.usageLimit ?? ''} />
        </label>
        <label className={label}>
          Uses per customer
          <input className={field} name="perUserLimit" inputMode="numeric" defaultValue={coupon?.perUserLimit ?? ''} />
        </label>
        <label className={label}>
          Expiry date
          <input className={field} type="date" name="expiresOn" defaultValue={dateInput(coupon?.expiresAt ?? null)} />
        </label>
      </div>
    </>
  );
}

export default async function CouponsPage({
  searchParams,
}: {
  searchParams: Promise<{ storeId?: string; notice?: string }>;
}) {
  const staff = await getCurrentUser();
  if (!staff || !['ADMIN', 'MANAGER'].includes(staff.role)) redirect('/login');
  const params = await searchParams;
  const allStores = await db.select().from(stores).orderBy(asc(stores.name)).all();
  const available = staff.role === 'ADMIN' ? allStores : allStores.filter((store) => store.id === staff.storeId);
  const selected =
    available.find((store) => store.id === (staff.role === 'ADMIN' ? params.storeId : staff.storeId)) ?? available[0];
  const entries = selected
    ? await db.select().from(coupons).where(eq(coupons.storeId, selected.id)).orderBy(asc(coupons.code)).all()
    : [];
  const uses = selected
    ? await db
        .select({ couponId: couponRedemptions.couponId, used: count() })
        .from(couponRedemptions)
        .innerJoin(orders, eq(orders.id, couponRedemptions.orderId))
        .where(and(eq(orders.storeId, selected.id), ne(orders.fulfillmentStatus, 'CANCELLED')))
        .groupBy(couponRedemptions.couponId)
        .all()
    : [];
  const usageByCoupon = new Map(uses.map((item) => [item.couponId, item.used]));

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-forest-700">Offers · Admin</p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-ink-900">Coupons</h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-600">
          Offers are scoped to one store. Each checkout line becomes its own sibling order, so a coupon redemption and
          usage count apply once per line.
        </p>
      </div>
      {params.notice && notices[params.notice] && (
        <p role="status" className="rounded-xl bg-ivory-100 p-3 text-sm text-ink-800">
          {notices[params.notice]}
        </p>
      )}
      {staff.role === 'ADMIN' && (
        <form className="max-w-sm" method="get">
          <label className={label}>
            Store
            <select className={field} name="storeId" defaultValue={selected?.id ?? ''}>
              {available.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>
          <button className={`${button} mt-3`} type="submit">
            View store
          </button>
        </form>
      )}
      {selected ? (
        <>
          <section className="rounded-2xl border border-ivory-300 bg-white p-5 shadow-sm">
            <h2 className="font-display text-xl font-semibold">Create coupon · {selected.name}</h2>
            <form action={createCoupon} className="mt-4 space-y-4">
              <CouponFields storeId={selected.id} role={staff.role} />
              <button className={button} type="submit">
                Create coupon
              </button>
            </form>
          </section>
          <section className="space-y-4">
            <h2 className="font-display text-xl font-semibold">Existing offers</h2>
            {entries.length === 0 && (
              <p className="rounded-xl bg-ivory-100 p-4 text-sm">No coupons for this store yet.</p>
            )}
            {entries.map((coupon) => {
              const used = usageByCoupon.get(coupon.id) ?? 0;
              return (
                <article key={coupon.id} className="rounded-2xl border border-ivory-300 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-display text-xl font-semibold">
                        {coupon.code}{' '}
                        <span
                          className={`ml-2 rounded-full px-2 py-1 text-xs ${coupon.active ? 'bg-green-100 text-green-800' : 'bg-ivory-200 text-ink-600'}`}
                        >
                          {coupon.active ? 'Active' : 'Inactive'}
                        </span>
                      </h3>
                      <p className="mt-1 text-sm text-ink-600">
                        {coupon.type.replace('_', ' ')} · {used} non-cancelled uses
                        {coupon.usageLimit !== null ? ` / ${coupon.usageLimit}` : ''}
                        {coupon.expiresAt ? ` · Expires ${new Date(coupon.expiresAt).toLocaleDateString('en-IN')}` : ''}
                      </p>
                    </div>
                    <form action={setCouponActive}>
                      <input type="hidden" name="couponId" value={coupon.id} />
                      <input type="hidden" name="storeId" value={selected.id} />
                      <input type="hidden" name="active" value={String(!coupon.active)} />
                      <button
                        className="rounded-ctrl border border-ivory-400 px-3 py-2 text-sm font-semibold"
                        type="submit"
                      >
                        {coupon.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </form>
                  </div>
                  <details>
                    <summary className="cursor-pointer text-sm font-semibold text-forest-800">
                      Edit coupon terms
                    </summary>
                    <form action={updateCoupon} className="mt-4 space-y-4">
                      <CouponFields coupon={coupon} storeId={selected.id} role={staff.role} />
                      <button className={button} type="submit">
                        Save changes
                      </button>
                    </form>
                  </details>
                </article>
              );
            })}
          </section>
        </>
      ) : (
        <p className="rounded-xl bg-ivory-100 p-4 text-sm">No store is assigned to this account.</p>
      )}
    </main>
  );
}
