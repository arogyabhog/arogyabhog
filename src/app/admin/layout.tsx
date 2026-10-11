import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth';
import { LogoutButton } from './logout-button';

export const dynamic = 'force-dynamic';

/** RBAC gate (ADR-014): the whole /admin tree re-checks the session
 *  server-side on every request. Customers and anonymous visitors bounce. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) redirect('/login');
  return (
    <main className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 sm:pt-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-forest-700">
            {user.role === 'ADMIN' ? 'Admin console · global' : `Manager console · ${user.storeId ?? 'store'}`}
          </div>
          <h1 className="font-display text-3xl font-semibold text-ink-900">Console</h1>
          <p className="text-sm text-ink-500">
            Signed in as {user.displayName ?? user.email} ({user.role})
          </p>
        </div>
        <nav className="flex items-center gap-5 text-sm font-semibold">
          <a href="/admin" className="text-ink-700 hover:text-forest-700">
            Overview
          </a>
          <a href="/admin/orders" className="text-ink-700 hover:text-forest-700">
            Orders
          </a>
          <a href="/admin/audit" className="text-ink-700 hover:text-forest-700">
            Audit log
          </a>
          <LogoutButton />
        </nav>
      </div>
      <div className="gold-rule mt-6" />
      <div className="mt-8 pb-16">{children}</div>
    </main>
  );
}
