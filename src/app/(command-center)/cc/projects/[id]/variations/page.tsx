import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatRp } from '@/core/money/rupiah';
import { getProjectAction } from '@/modules/projects';
import { listChangeOrdersForProjectAction } from '@/modules/scope-variation';
import { CreateVariationForm } from './create-variation-form';

export const metadata = { title: 'Variation — BuildTrust OS' };

const STATUS_LABEL_ID: Record<string, string> = {
  draft: 'Draft',
  under_review: 'Direview internal',
  awaiting_client_approval: 'Menunggu keputusan klien',
  approved_unpaid: 'Disetujui, menunggu dana',
  approved_funded: 'Dana masuk, siap dikerjakan',
  rejected: 'Ditolak',
  completed: 'Selesai',
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  under_review: 'bg-amber-100 text-amber-800',
  awaiting_client_approval: 'bg-blue-100 text-blue-800',
  approved_unpaid: 'bg-amber-100 text-amber-800',
  approved_funded: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  completed: 'bg-slate-900 text-white',
};

export default async function VariationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const [projectResult, changeOrdersResult] = await Promise.all([
    getProjectAction(projectId),
    listChangeOrdersForProjectAction(projectId),
  ]);

  if (!projectResult.ok) {
    if (projectResult.error.code === 'NOT_FOUND') notFound();
    return (
      <p role="alert" className="text-sm text-red-600">
        {projectResult.error.message}
      </p>
    );
  }

  const project = projectResult.data;
  const changeOrders = changeOrdersResult.ok ? changeOrdersResult.data : [];

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/cc/projects/${project.id}`} className="text-sm text-slate-500 hover:text-slate-900">
          ← {project.name}
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">Variation (Permintaan Perubahan)</h1>
      </div>

      <section className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Ajukan variation baru</h2>
        <CreateVariationForm projectId={project.id} />
      </section>

      <section className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Daftar variation</h2>
        {!changeOrdersResult.ok && (
          <p role="alert" className="text-sm text-red-600">
            {changeOrdersResult.error.message}
          </p>
        )}
        {changeOrders.length === 0 && <p className="text-sm text-slate-500">Belum ada variation.</p>}
        {changeOrders.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Judul</th>
                  <th className="px-4 py-2 font-medium">Dampak biaya</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {changeOrders.map((co) => (
                  <tr key={co.id}>
                    <td className="px-4 py-2 font-medium text-slate-900">
                      <Link href={`/cc/projects/${project.id}/variations/${co.id}`} className="hover:underline">
                        {co.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {co.cost_impact_amount === null ? '—' : formatRp(co.cost_impact_amount)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[co.status] ?? 'bg-slate-100 text-slate-700'}`}
                      >
                        {STATUS_LABEL_ID[co.status] ?? co.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
