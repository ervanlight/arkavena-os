import { listHandoverItemsForProjectAction, listWarrantiesForProjectAction } from '@/modules/maintenance-engine';
import { CreateHandoverItemForm } from './handover-item-form';

export const metadata = { title: 'Handover & Garansi — BuildTrust OS' };

const WARRANTY_STATUS_LABEL_ID: Record<string, string> = {
  active: 'Aktif',
  expired: 'Kedaluwarsa',
  claimed: 'Diklaim',
};

export default async function ProjectHandoverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [itemsResult, warrantiesResult] = await Promise.all([
    listHandoverItemsForProjectAction(id),
    listWarrantiesForProjectAction(id),
  ]);
  const items = itemsResult.ok ? itemsResult.data : [];
  const warranties = warrantiesResult.ok ? warrantiesResult.data : [];

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-semibold text-slate-900">Handover & Garansi</h1>

      <div className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Item handover</h2>
        {items.length === 0 && <p className="text-sm text-slate-500">Belum ada item handover.</p>}
        {items.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Jenis</th>
                  <th className="px-4 py-2 font-medium">Deskripsi</th>
                  <th className="px-4 py-2 font-medium">Diserahkan kepada</th>
                  <th className="px-4 py-2 font-medium">Tanggal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2 font-medium text-slate-900">{item.item_type}</td>
                    <td className="px-4 py-2 text-slate-600">{item.description ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-600">{item.handed_over_to ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {item.handed_over_at !== null ? new Date(item.handed_over_at).toLocaleDateString('id-ID') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="rounded-lg border border-dashed border-slate-300 p-4">
          <CreateHandoverItemForm projectId={id} />
        </div>
      </div>

      <div className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Garansi</h2>
        <p className="text-sm text-slate-500">
          Garansi dibuat otomatis saat proyek ditandai selesai, untuk setiap item handover yang membutuhkannya.
        </p>
        {warranties.length === 0 && <p className="text-sm text-slate-500">Belum ada garansi.</p>}
        {warranties.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Judul</th>
                  <th className="px-4 py-2 font-medium">Mulai</th>
                  <th className="px-4 py-2 font-medium">Berakhir</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {warranties.map((warranty) => (
                  <tr key={warranty.id}>
                    <td className="px-4 py-2 font-medium text-slate-900">{warranty.title}</td>
                    <td className="px-4 py-2 text-slate-600">{warranty.starts_at}</td>
                    <td className="px-4 py-2 text-slate-600">{warranty.ends_at}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {WARRANTY_STATUS_LABEL_ID[warranty.status] ?? warranty.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
