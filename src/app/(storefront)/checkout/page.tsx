import { redirect } from 'next/navigation';
import { CheckoutClient } from '@/components/CheckoutClient';
import { getCurrentUser } from '@/server/auth';
import { getStorefront } from '@/server/storefront-data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Checkout · ArogyaBhog' };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/checkout');
  const { preMades, singles } = await getStorefront();
  return (
    <CheckoutClient
      userName={user.displayName ?? ''}
      products={[...singles, ...preMades].map((p) => ({
        slug: p.slug,
        name: p.name,
        packs: p.packs,
      }))}
      failed={(await searchParams).error === '1'}
    />
  );
}
