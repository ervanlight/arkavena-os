import { listSitesAction } from '@/modules/crm';
import { PageHeader } from '@/core/ui';
import { NewAssetForm } from './asset-form';

export const metadata = { title: 'Tambah aset — BuildTrust OS' };

export default async function NewAssetPage() {
  const sitesResult = await listSitesAction(undefined);

  return (
    <div className="space-y-6">
      <PageHeader title="Tambah aset" />
      <NewAssetForm sites={sitesResult.ok ? sitesResult.data : []} />
    </div>
  );
}
