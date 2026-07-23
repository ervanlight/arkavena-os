import Link from 'next/link';
import { listEstimatesForProjectAction } from '@/modules/estimating';

export const metadata = { title: 'Estimasi — BuildTrust OS' };

const STATUS_LABEL_ID: Record<string, string> = {
  draft: 'Draft',
  sent: 'Terkirim',
  accepted: 'Diterima',
  rejected: 'Ditolak',
  superseded: 'Digantikan',
};

export default async function ProjectEstimatesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await listEstimatesForProjectAction(id);
  const estimates = result.ok ? result.data : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Estimasi</h1>
        <Link
          href={`/cc/projects/${id}/estimates/new`}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Buat estimasi
        </Link>
      </div>

      {!result.ok && (
        <p role="alert" className="text-sm text-red-600">
          {result.error.message}
        </p>
      )}

      {result.ok && estimates.length === 0 && (
        <p className="text-sm text-slate-500">Belum ada estimasi untuk proyek ini.</p>
      )}

      {estimates.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Versi</th>
                <th className="px-4 py-2 font-medium">Judul</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Baseline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {estimates.map((estimate) => (
                <tr key={estimate.id}>
                  <td className="px-4 py-2 font-medium text-slate-900">
                    <Link href={`/cc/projects/${id}/estimates/${estimate.id}`} className="hover:underline">
                      V{estimate.version}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{estimate.title}</td>
                  <td className="px-4 py-2 text-slate-600">{STATUS_LABEL_ID[estimate.status] ?? estimate.status}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {estimate.is_baseline ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        Baseline
                      </span>
                    ) : (
                      '—'
                    )}
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
