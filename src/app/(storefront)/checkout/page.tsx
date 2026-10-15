import { redirect } from 'next/navigation';
import { CheckoutClient } from '@/components/CheckoutClient';
import { getCurrentUser } from '@/server/auth';
import { getStorefront } from '@/server/storefront-data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Checkout · ArogyaBhog' };

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; couponError?: string; creditError?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/checkout');
  const { preMades, singles } = await getStorefront();
  const params = await searchParams;
  return (
    <CheckoutClient
      userName={user.displayName ?? ''}
      availableReferralCredits={user.freeDeliveryCredits}
      products={[...singles, ...preMades].map((p) => ({
        slug: p.slug,
        name: p.name,
        packs: p.packs,
      }))}
      failed={params.error === '1'}
      couponError={params.couponError ?? ''}
      creditError={params.creditError ?? ''}
    />
  );
}
