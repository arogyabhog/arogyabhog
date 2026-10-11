import { LabClient } from '@/components/LabClient';
import { SEED_STORE_ID } from '@/db/seed';
import { getStorefront } from '@/server/storefront-data';

export const dynamic = 'force-dynamic';

export default async function LabPage({ searchParams }: { searchParams: Promise<{ template?: string | string[] }> }) {
  const sp = await searchParams;
  const templateSlug = typeof sp.template === 'string' ? sp.template : undefined;
  const { ingredients, preMades } = await getStorefront();
  const chosen = preMades.find((p) => p.slug === templateSlug) ?? preMades.find((p) => p.slug === 'everyday-atta');

  return (
    <main>
      <LabClient
        storeId={SEED_STORE_ID}
        packs={[5000, 10000, 15000, 20000]}
        ingredients={ingredients}
        preMades={preMades}
        template={chosen?.template ?? []}
        templateSlug={chosen?.slug}
      />
    </main>
  );
}
