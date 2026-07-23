import Link from 'next/link';
import { listAssessmentsAction } from '@/modules/assessment';

export const metadata = { title: 'Assessment — BuildTrust OS' };

const STATUS_LABEL_ID: Record<string, string> = {
  scheduled: 'Terjadwal',
  completed: 'Selesai',
};

export default async function AssessmentsPage() {
  const result = await listAssessmentsAction(undefined);
  const assessments = result.ok ? result.data : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Assessment</h1>
        <Link
          href="/cc/assessments/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Tambah assessment
        </Link>
      </div>

      {!result.ok && (
        <p role="alert" className="text-sm text-red-600">
          {result.error.message}
        </p>
      )}

      {result.ok && assessments.length === 0 && (
        <p className="text-sm text-slate-500">Belum ada assessment. Tambahkan assessment pertama Anda.</p>
      )}

      {assessments.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Ruang lingkup direkomendasikan</th>
                <th className="px-4 py-2 font-medium">Dibuat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assessments.map((assessment) => (
                <tr key={assessment.id}>
                  <td className="px-4 py-2 font-medium text-slate-900">
                    <Link href={`/cc/assessments/${assessment.id}`} className="hover:underline">
                      {STATUS_LABEL_ID[assessment.status] ?? assessment.status}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{assessment.recommended_scope ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {new Date(assessment.created_at).toLocaleDateString('id-ID')}
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
