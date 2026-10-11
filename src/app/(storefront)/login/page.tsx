import { login } from './actions';

export const metadata = { title: 'Sign in · ArogyaBhog' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const sp = await searchParams;
  const failed = sp.error === '1';
  const next = sp.next?.startsWith('/') && !sp.next.startsWith('//') ? sp.next : '';
  return (
    <main className="mx-auto flex max-w-6xl justify-center px-4 py-16 sm:px-6 sm:py-24">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-forest-700">Welcome back</div>
          <h1 className="font-display text-3xl font-semibold text-ink-900">Sign in</h1>
          <p className="text-sm text-ink-500">
            Track your orders, or open the staff console. Every sign-in is audit-logged.
          </p>
        </div>
        <form action={login} className="space-y-4 rounded-card border border-ivory-300 bg-white p-6 shadow-warm">
          {next && <input type="hidden" name="next" value={next} />}
          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-[0.1em] text-ink-500">Email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="username"
              className="w-full rounded-ctrl border border-ivory-300 bg-ivory-50 px-3 py-2.5 text-sm font-semibold text-ink-900 focus:border-forest-600 focus:outline-none"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-[0.1em] text-ink-500">Password</span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-ctrl border border-ivory-300 bg-ivory-50 px-3 py-2.5 text-sm font-semibold text-ink-900 focus:border-forest-600 focus:outline-none"
            />
          </label>
          {failed && (
            <p className="rounded-ctrl bg-danger-soft px-3 py-2 text-xs font-bold text-danger">
              Email or password does not match our records.
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded-ctrl bg-forest-800 px-6 py-3 text-sm font-bold text-gold-100 shadow-warm transition hover:bg-forest-700"
          >
            Sign in
          </button>
          {(process.env.NODE_ENV !== 'production' || process.env.ARENA_EMBEDDED_PREVIEW === '1') && (
            <p className="text-[11px] leading-5 text-ink-500">
              Dev credentials: owner@arogyabhog.local / arogyabhog-dev-admin · manager@arogyabhog.local /
              arogyabhog-dev-manager
            </p>
          )}
        </form>
        <p className="text-center text-sm text-ink-500">
          New here?{' '}
          <a
            href={`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`}
            className="font-bold text-forest-700 hover:underline"
          >
            Create an account
          </a>{' '}
          — one free delivery on your first order.
        </p>
      </div>
    </main>
  );
}
