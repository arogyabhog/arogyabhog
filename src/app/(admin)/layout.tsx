import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth';
import { LogoutButton } from './admin/logout-button';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · ArogyaBhog' };

/** Staff-only admin shell, intentionally separate from all customer storefront chrome. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) redirect('/login');

  return (
    <div className="min-h-screen bg-ivory-50">
      <header className="border-b border-forest-800 bg-forest-950 text-ivory-50">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-mark.png" alt="" className="h-9 w-9 rounded-full bg-ivory-50 p-0.5" />
            <div>
              <Link href="/admin" className="font-display text-lg font-semibold tracking-tight hover:text-gold-200">
                ArogyaBhog Admin
              </Link>
              <p className="mt-0.5 text-xs text-forest-100/80">
                {user.role === 'ADMIN' ? 'Owner · all stores' : `Manager · ${user.storeId ?? 'unassigned store'}`}
                {' · '}
                {user.displayName ?? user.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xs font-semibold text-forest-100 hover:text-gold-200">
              View storefront
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="border-b border-ivory-300 bg-white px-3 py-3 lg:min-h-[calc(100vh-74px)] lg:border-b-0 lg:border-r lg:px-4 lg:py-6">
          <nav aria-label="Admin navigation" className="flex gap-2 overflow-x-auto lg:sticky lg:top-6 lg:flex-col">
            <Link
              href="/admin"
              className="whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-semibold text-ink-700 hover:bg-forest-50 hover:text-forest-800"
            >
              Overview
            </Link>
            <Link
              href="/admin/orders"
              className="whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-semibold text-ink-700 hover:bg-forest-50 hover:text-forest-800"
            >
              Orders & payments
            </Link>
            <Link
              href="/admin/products"
              className="whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-semibold text-ink-700 hover:bg-forest-50 hover:text-forest-800"
            >
              Products
            </Link>
            <Link
              href="/admin/audit"
              className="whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-semibold text-ink-700 hover:bg-forest-50 hover:text-forest-800"
            >
              Audit log
            </Link>
          </nav>
        </aside>
        <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
