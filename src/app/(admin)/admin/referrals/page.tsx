import { and, asc, count, desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { orders, referrals, stores, users } from '@/db/schema';
import { getCurrentUser } from '@/server/auth';

export const dynamic = 'force-dynamic';
const field = 'mt-1 w-full rounded-ctrl border border-ivory-300 bg-white px-3 py-2 text-sm';
const card = 'rounded-2xl border border-ivory-300 bg-white p-5 shadow-sm';
const referrerUsers = alias(users, 'referrer_users');
const refereeUsers = alias(users, 'referee_users');

export default async function ReferralsPage({ searchParams }: { searchParams: Promise<{ storeId?: string }> }) {
  const staff = await getCurrentUser();
  if (!staff || !['ADMIN', 'MANAGER'].includes(staff.role)) redirect('/login');
  const params = await searchParams;
  const allStores = await db.select().from(stores).orderBy(asc(stores.name)).all();
  const availableStores = staff.role === 'ADMIN' ? allStores : allStores.filter((store) => store.id === staff.storeId);
  const selected =
    availableStores.find((store) => store.id === (staff.role === 'ADMIN' ? params.storeId : staff.storeId)) ??
    availableStores[0];

  const rows = selected
    ? await db
        .select({
          id: referrals.id,
          code: referrals.referralCode,
          status: referrals.status,
          creditAwarded: referrals.creditAwarded,
          creditedOrderId: referrals.creditedOrderId,
          createdAt: referrals.createdAt,
          signupDeviceHash: referrals.signupDeviceHash,
          referrerName: referrerUsers.displayName,
          referrerEmail: referrerUsers.email,
          refereeName: refereeUsers.displayName,
          refereeEmail: refereeUsers.email,
          refereeId: referrals.refereeUserId,
          orderCount: count(orders.id),
        })
        .from(referrals)
        .innerJoin(referrerUsers, eq(referrerUsers.id, referrals.referrerUserId))
        .leftJoin(refereeUsers, eq(refereeUsers.id, referrals.refereeUserId))
        .leftJoin(orders, and(eq(orders.userId, referrals.refereeUserId), eq(orders.storeId, referrals.storeId)))
        .where(eq(referrals.storeId, selected.id))
        .groupBy(referrals.id, referrerUsers.id, refereeUsers.id)
        .orderBy(desc(referrals.createdAt))
        .all()
    : [];

  const deviceCounts = new Map<string, number>();
  for (const row of rows) {
    if (row.signupDeviceHash) deviceCounts.set(row.signupDeviceHash, (deviceCounts.get(row.signupDeviceHash) ?? 0) + 1);
  }
  const [pending, credited, capped] = await Promise.all(
    selected
      ? [
          db
            .select({ n: count() })
            .from(referrals)
            .where(and(eq(referrals.storeId, selected.id), eq(referrals.status, 'PENDING')))
            .get(),
          db
            .select({ n: count() })
            .from(referrals)
            .where(and(eq(referrals.storeId, selected.id), eq(referrals.status, 'CREDITED')))
            .get(),
          db
            .select({ n: count() })
            .from(referrals)
            .where(and(eq(referrals.storeId, selected.id), eq(referrals.status, 'CAPPED')))
            .get(),
        ]
      : [Promise.resolve(undefined), Promise.resolve(undefined), Promise.resolve(undefined)],
  );

  return (
    <main className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-forest-700">Growth · Admin</p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-ink-900">Referrals</h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-600">
          A referral stays pending until the referee’s first delivered order. Repeat-browser signals are review-only and
          never block signup or checkout.
        </p>
      </header>
      {staff.role === 'ADMIN' && (
        <form method="get" className="max-w-sm">
          <label className="block text-sm font-semibold text-ink-800">
            Store
            <select className={field} name="storeId" defaultValue={selected?.id ?? ''}>
              {availableStores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>
          <button className="mt-3 rounded-ctrl bg-forest-700 px-3 py-2 text-sm font-semibold text-white" type="submit">
            View store
          </button>
        </form>
      )}
      {selected ? (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            {[
              ['Pending first delivery', pending?.n ?? 0],
              ['Credits awarded', credited?.n ?? 0],
              ['Reached store cap', capped?.n ?? 0],
            ].map(([label, value]) => (
              <div key={label} className={card}>
                <p className="text-xs font-bold uppercase tracking-wide text-forest-700">{label}</p>
                <p className="mt-2 font-display text-3xl font-bold text-ink-900">{value}</p>
              </div>
            ))}
          </section>
          <section className={card}>
            <h2 className="font-display text-xl font-semibold text-ink-900">Referral history · {selected.name}</h2>
            {rows.length === 0 ? (
              <p className="mt-4 text-sm text-ink-600">No referred accounts yet.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[850px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-ivory-300 text-xs uppercase tracking-wide text-ink-500">
                      <th className="py-3 pr-4">Signup</th>
                      <th className="py-3 pr-4">Referrer</th>
                      <th className="py-3 pr-4">Referred customer</th>
                      <th className="py-3 pr-4">Status</th>
                      <th className="py-3 pr-4">Abuse signals</th>
                      <th className="py-3">Qualifying order</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ivory-200">
                    {rows.map((row) => {
                      const sameDeviceCount = row.signupDeviceHash ? (deviceCounts.get(row.signupDeviceHash) ?? 0) : 0;
                      const signals = [
                        row.orderCount === 0 ? 'No orders yet' : null,
                        sameDeviceCount > 1 ? `Shared browser token · ${sameDeviceCount} referrals` : null,
                      ].filter(Boolean);
                      return (
                        <tr key={row.id} className="align-top">
                          <td className="py-3 pr-4 whitespace-nowrap text-ink-600">
                            {new Date(row.createdAt).toLocaleDateString('en-IN')}
                          </td>
                          <td className="py-3 pr-4">
                            <span className="font-semibold text-ink-900">{row.referrerName ?? 'Customer'}</span>
                            <span className="block text-xs text-ink-500">{row.referrerEmail}</span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="font-semibold text-ink-900">{row.refereeName ?? 'Customer'}</span>
                            <span className="block text-xs text-ink-500">{row.refereeEmail}</span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="rounded-full bg-ivory-100 px-2.5 py-1 text-xs font-bold text-ink-700">
                              {row.status}
                            </span>
                            {row.creditAwarded && (
                              <span className="mt-1 block text-xs text-leaf">+1 delivery credit</span>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-xs text-ink-600">
                            {signals.length ? signals.join(' · ') : '—'}
                          </td>
                          <td className="py-3 font-mono text-xs text-ink-700">{row.creditedOrderId ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <p className={card}>No store is assigned to this account.</p>
      )}
    </main>
  );
}
