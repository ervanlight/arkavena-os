import Link from 'next/link';
import { listLeadsAction } from '@/modules/crm';

export const metadata = { title: 'Leads — BuildTrust OS' };

const STATUS_LABEL_ID: Record<string, string> = {
  new: 'Baru',
  contacted: 'Dihubungi',
  qualified: 'Qualified',
  assessment_scheduled: 'Assessment terjadwal',
  proposal_sent: 'Proposal terkirim',
  won: 'Won',
  lost: 'Lost',
};

export default async function LeadsPage() {
  const result = await listLeadsAction(undefined);
  const leads = result.ok ? result.data : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Leads</h1>
        <Link
          href="/cc/leads/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Tambah lead
        </Link>
      </div>

      {!result.ok && (
        <p role="alert" className="text-sm text-red-600">
          {result.error.message}
        </p>
      )}

      {result.ok && leads.length === 0 && (
        <p className="text-sm text-slate-500">Belum ada lead. Tambahkan lead pertama Anda.</p>
      )}

      {leads.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Kontak</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Sumber</th>
                <th className="px-4 py-2 font-medium">Estimasi nilai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td className="px-4 py-2 font-medium text-slate-900">
                    <Link href={`/cc/leads/${lead.id}`} className="hover:underline">
                      {lead.contact_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{STATUS_LABEL_ID[lead.status] ?? lead.status}</td>
                  <td className="px-4 py-2 text-slate-600">{lead.source ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {lead.estimated_value !== null ? `Rp ${lead.estimated_value.toLocaleString('id-ID')}` : '—'}
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
