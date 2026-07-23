import Link from 'next/link';
import { listAssetsAction } from '@/modules/maintenance-engine';

export const metadata = { title: 'Aset — BuildTrust OS' };

export default async function AssetsPage() {
  const result = await listAssetsAction(undefined);
  const assets = result.ok ? result.data : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Aset (Facility Passport)</h1>
        <Link
          href="/cc/assets/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Tambah aset
        </Link>
      </div>

      {!result.ok && (
        <p role="alert" className="text-sm text-red-600">
          {result.error.message}
        </p>
      )}

      {result.ok && assets.length === 0 && <p className="text-sm text-slate-500">Belum ada aset.</p>}

      {assets.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Nama</th>
                <th className="px-4 py-2 font-medium">Kategori</th>
                <th className="px-4 py-2 font-medium">Merek/Model</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assets.map((asset) => (
                <tr key={asset.id}>
                  <td className="px-4 py-2 font-medium text-slate-900">
                    <Link href={`/cc/assets/${asset.id}`} className="hover:underline">
                      {asset.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{asset.category ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {[asset.manufacturer, asset.model].filter(Boolean).join(' / ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
