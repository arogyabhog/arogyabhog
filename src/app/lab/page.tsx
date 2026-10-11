import { LabClient } from '@/components/LabClient';
import { SEED_STORE_ID } from '@/db/seed';
import { getStorefront } from '@/server/storefront-data';

export const dynamic = 'force-dynamic';

/** The Lab = "mix your own" (ADR-029). House mixes appear as locked,
 *  order-as-is cards above the composer; no template is ever loaded into it. */
export default async function LabPage() {
  const { ingredients, preMades } = await getStorefront();
  return (
    <main>
      <LabClient
        storeId={SEED_STORE_ID}
        packs={[5000, 10000, 15000, 20000]}
        ingredients={ingredients}
        preMades={preMades}
      />
    </main>
  );
}
