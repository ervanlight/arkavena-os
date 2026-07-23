import Link from 'next/link';
import { listCostLibraryItemsAction } from '@/modules/estimating';

export const metadata = { title: 'Cost Library — BuildTrust OS' };

export default async function CostLibraryPage() {
  const result = await listCostLibraryItemsAction(undefined);
  const items = result.ok ? result.data : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Cost Library</h1>
        <Link
          href="/cc/cost-library/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Tambah item
        </Link>
      </div>

      {!result.ok && (
        <p role="alert" className="text-sm text-red-600">
          {result.error.message}
        </p>
      )}

      {result.ok && items.length === 0 && (
        <p className="text-sm text-slate-500">Belum ada item cost library.</p>
      )}

      {items.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Nama</th>
                <th className="px-4 py-2 font-medium">Satuan</th>
                <th className="px-4 py-2 font-medium">Harga satuan</th>
                <th className="px-4 py-2 font-medium">Kategori</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-2 font-medium text-slate-900">{item.name}</td>
                  <td className="px-4 py-2 text-slate-600">{item.unit}</td>
                  <td className="px-4 py-2 text-slate-600">
                    Rp {item.default_unit_cost.toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{item.category ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
