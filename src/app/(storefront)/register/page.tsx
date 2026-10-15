import { register } from '@/app/(storefront)/login/actions';
import { ReferralDeviceToken } from '@/components/ReferralDeviceToken';

export const metadata = { title: 'Create account · ArogyaBhog' };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ref?: string }>;
}) {
  const params = await searchParams;
  const err = params.error;
  const referralPrefill = params.ref?.slice(0, 32).toUpperCase() ?? '';
  return (
    <main className="mx-auto flex max-w-6xl justify-center px-4 py-16 sm:px-6 sm:py-24">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-forest-700">Join the table</div>
          <h1 className="font-display text-3xl font-semibold text-ink-900">Create your account</h1>
          <p className="text-sm text-ink-500">Needed for checkout, order tracking and referral credits.</p>
        </div>
        <form action={register} className="space-y-4 rounded-card border border-ivory-300 bg-white p-6 shadow-warm">
          <ReferralDeviceToken />
          {err === '1' && (
            <p className="rounded-ctrl bg-danger-soft px-3 py-2 text-xs font-bold text-danger">
              Name too short, or password under 8 characters.
            </p>
          )}
          {err === '2' && (
            <p className="rounded-ctrl bg-danger-soft px-3 py-2 text-xs font-bold text-danger">
              That email is already registered — sign in instead.
            </p>
          )}
          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-[0.1em] text-ink-500">Full name</span>
            <input
              name="name"
              required
              className="w-full rounded-ctrl border border-ivory-300 bg-ivory-50 px-3 py-2.5 text-sm font-semibold text-ink-900 focus:border-forest-600 focus:outline-none"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-[0.1em] text-ink-500">Email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-ctrl border border-ivory-300 bg-ivory-50 px-3 py-2.5 text-sm font-semibold text-ink-900 focus:border-forest-600 focus:outline-none"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-[0.1em] text-ink-500">Password (8+ characters)</span>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-ctrl border border-ivory-300 bg-ivory-50 px-3 py-2.5 text-sm font-semibold text-ink-900 focus:border-forest-600 focus:outline-none"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-[0.1em] text-ink-500">Referral code (optional)</span>
            <input
              name="referral"
              placeholder="e.g. OWNER0001"
              defaultValue={referralPrefill}
              maxLength={32}
              className="w-full rounded-ctrl border border-ivory-300 bg-ivory-50 px-3 py-2.5 text-sm font-semibold text-ink-900 focus:border-forest-600 focus:outline-none"
            />
            <span className="block text-xs leading-5 text-ink-500">
              To flag referral abuse, we store a hash of a random browser token—not a fingerprint or IP address. It is a
              review signal only.
            </span>
          </label>
          <button
            type="submit"
            className="w-full rounded-ctrl bg-forest-800 px-6 py-3 text-sm font-bold text-gold-100 shadow-warm transition hover:bg-forest-700"
          >
            Create account
          </button>
          <p className="text-center text-xs text-ink-500">
            Already registered?{' '}
            <a href="/login" className="font-bold text-forest-700 hover:underline">
              Sign in
            </a>
          </p>
        </form>
      </div>
    </main>
  );
}
