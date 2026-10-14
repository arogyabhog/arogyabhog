import { asc } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { stores } from '@/db/schema';
import { getCurrentUser } from '@/server/auth';
import { updateStoreSettings } from './actions';

export const dynamic = 'force-dynamic';

const moneyInput = (paise: number) => `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, '0')}`;
const fieldClass =
  'mt-1.5 w-full rounded-ctrl border border-ivory-300 bg-white px-3 py-2.5 text-sm text-ink-900 focus:border-forest-600 focus:outline-none';
const labelClass = 'block text-sm font-semibold text-ink-800';

export default async function StoreSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ storeId?: string; notice?: string }>;
}) {
  const staff = await getCurrentUser();
  if (!staff || (staff.role !== 'ADMIN' && staff.role !== 'MANAGER')) redirect('/login');
  const params = await searchParams;
  const allStores = await db.select().from(stores).orderBy(asc(stores.name)).all();
  const availableStores = staff.role === 'ADMIN' ? allStores : allStores.filter((s) => s.id === staff.storeId);
  const selectedId = staff.role === 'ADMIN' ? params.storeId : (staff.storeId ?? undefined);
  const selected = availableStores.find((s) => s.id === selectedId) ?? availableStores[0];
  const notice = params.notice;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-forest-700">Administration</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-ink-900">Store settings</h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-500">
          Manage store identity, checkout fees, mix rules, referral limits, and the price-review threshold. Changes
          affect new calculations and orders; existing order snapshots stay unchanged.
        </p>
      </header>

      {staff.role === 'ADMIN' && availableStores.length > 0 && (
        <form
          method="get"
          className="flex flex-wrap items-end gap-3 rounded-card border border-ivory-300 bg-white p-4 shadow-warm"
        >
          <label className="min-w-56 flex-1 text-sm font-semibold text-ink-800">
            Store
            <select name="storeId" defaultValue={selected?.id} className={fieldClass}>
              {availableStores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name} · {store.city}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-ctrl bg-forest-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-forest-700"
          >
            Select store
          </button>
        </form>
      )}

      {!selected ? (
        <div className="rounded-card border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
          {staff.role === 'MANAGER' ? 'No store is assigned to this manager account.' : 'No stores are configured yet.'}
        </div>
      ) : (
        <>
          {notice && (
            <p
              role="status"
              className={`rounded-ctrl px-4 py-3 text-sm font-semibold ${notice === 'saved' ? 'bg-forest-50 text-forest-900' : 'bg-danger-soft text-danger'}`}
            >
              {notice === 'saved'
                ? 'Store settings saved and audited.'
                : notice === 'invalid'
                  ? 'Some values are invalid. Check the allowed ranges and try again.'
                  : notice === 'unavailable'
                    ? 'That store is unavailable to your account.'
                    : 'Save failed. No changes were applied; please retry.'}
            </p>
          )}

          <form action={updateStoreSettings} className="space-y-6">
            <input type="hidden" name="storeId" value={selected.id} />
            <section className="rounded-card border border-ivory-300 bg-white p-5 shadow-warm sm:p-6">
              <h2 className="font-display text-xl font-semibold text-ink-900">Store identity and payments</h2>
              <p className="mt-1 text-xs text-ink-500">
                The VPA is encoded in new UPI payment instructions. Confirm the merchant’s exact VPA before changing it.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className={labelClass}>
                  Store name
                  <input
                    className={fieldClass}
                    name="name"
                    required
                    minLength={2}
                    maxLength={100}
                    defaultValue={selected.name}
                  />
                </label>
                <label className={labelClass}>
                  City / region
                  <input
                    className={fieldClass}
                    name="city"
                    required
                    minLength={2}
                    maxLength={100}
                    defaultValue={selected.city}
                  />
                </label>
                <label className={labelClass}>
                  UPI VPA
                  <input
                    className={fieldClass}
                    name="upiVpa"
                    required
                    maxLength={256}
                    defaultValue={selected.upiVpa}
                    autoComplete="off"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-card border border-ivory-300 bg-white p-5 shadow-warm sm:p-6">
              <h2 className="font-display text-xl font-semibold text-ink-900">Fees and tax</h2>
              <p className="mt-1 text-xs text-ink-500">
                Enter fees in rupees. GST is an integer basis-point rate (500 bps = 5%).
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className={labelClass}>
                  Delivery · ₹ / order
                  <input
                    className={fieldClass}
                    name="deliveryFeeRupees"
                    required
                    inputMode="decimal"
                    defaultValue={moneyInput(selected.deliveryFeePaise)}
                  />
                </label>
                <label className={labelClass}>
                  Packaging · ₹ / pack
                  <input
                    className={fieldClass}
                    name="packagingFeeRupees"
                    required
                    inputMode="decimal"
                    defaultValue={moneyInput(selected.packagingFeePaise)}
                  />
                </label>
                <label className={labelClass}>
                  Milling · ₹ / kg
                  <input
                    className={fieldClass}
                    name="millingFeeRupeesPerKg"
                    required
                    inputMode="decimal"
                    defaultValue={moneyInput(selected.millingFeePaisePerKg)}
                  />
                </label>
                <label className={labelClass}>
                  GST · basis points
                  <input
                    className={fieldClass}
                    name="gstRateBps"
                    required
                    type="number"
                    min={0}
                    max={10000}
                    step={1}
                    defaultValue={selected.gstRateBps}
                  />
                </label>
              </div>
            </section>

            <section className="rounded-card border border-ivory-300 bg-white p-5 shadow-warm sm:p-6">
              <h2 className="font-display text-xl font-semibold text-ink-900">Mix and referral rules</h2>
              <p className="mt-1 text-xs text-ink-500">
                Pack sizes are grams, comma-separated. The Lab supports only the listed sizes; boxed product sizes are
                managed separately.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className={labelClass}>
                  Mix pack sizes · g
                  <input
                    className={fieldClass}
                    name="allowedPackSizesG"
                    required
                    defaultValue={JSON.parse(selected.allowedPackSizesG).join(',')}
                  />
                </label>
                <label className={labelClass}>
                  Minimum base-grain share · bps
                  <input
                    className={fieldClass}
                    name="minBaseGrainBps"
                    required
                    type="number"
                    min={0}
                    max={10000}
                    step={1}
                    defaultValue={selected.minBaseGrainBps}
                  />
                </label>
                <label className={labelClass}>
                  Referral credit cap
                  <input
                    className={fieldClass}
                    name="referralCreditCap"
                    required
                    type="number"
                    min={0}
                    max={10000}
                    step={1}
                    defaultValue={selected.referralCreditCap}
                  />
                </label>
                <label className={labelClass}>
                  Referred-customer bonus credits
                  <input
                    className={fieldClass}
                    name="refereeBonusCredits"
                    required
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    defaultValue={selected.refereeBonusCredits}
                  />
                </label>
              </div>
            </section>

            <section className="rounded-card border border-amber-200 bg-amber-50 p-5 sm:p-6">
              <h2 className="font-display text-xl font-semibold text-ink-900">Price consistency review</h2>
              <p className="mt-1 text-xs text-ink-600">
                A provisional rate still always requires review. Otherwise this tolerance controls when the checker
                warns about a shelf-price difference.
              </p>
              <label className={`${labelClass} mt-4 max-w-sm`}>
                Warning tolerance · basis points
                <input
                  className={fieldClass}
                  name="priceConsistencyToleranceBps"
                  required
                  type="number"
                  min={0}
                  max={10000}
                  step={1}
                  defaultValue={selected.priceConsistencyToleranceBps}
                />
              </label>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-2xl text-xs text-ink-500">
                Every save is recorded in the audit log. Use zero fees or zero referral values only when that is the
                intended store policy.
              </p>
              <button
                type="submit"
                className="rounded-ctrl bg-forest-900 px-6 py-3 text-sm font-bold text-white shadow-warm hover:bg-forest-800"
              >
                Save store settings
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
