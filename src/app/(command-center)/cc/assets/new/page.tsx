import { listSitesAction } from '@/modules/crm';
import { NewAssetForm } from './asset-form';

export const metadata = { title: 'Tambah aset — BuildTrust OS' };

export default async function NewAssetPage() {
  const sitesResult = await listSitesAction(undefined);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Tambah aset</h1>
      <NewAssetForm sites={sitesResult.ok ? sitesResult.data : []} />
    </div>
  );
}
