import Link from 'next/link';
import { listClientsAction } from '@/modules/crm';

export const metadata = { title: 'Klien — BuildTrust OS' };

export default async function ClientsPage() {
  const result = await listClientsAction(undefined);
  const clients = result.ok ? result.data : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Klien</h1>
        <Link
          href="/cc/clients/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Tambah klien
        </Link>
      </div>

      {!result.ok && (
        <p role="alert" className="text-sm text-red-600">
          {result.error.message}
        </p>
      )}

      {result.ok && clients.length === 0 && (
        <p className="text-sm text-slate-500">Belum ada klien. Tambahkan klien pertama Anda.</p>
      )}

      {clients.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Nama</th>
                <th className="px-4 py-2 font-medium">Kontak</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Telepon</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.map((client) => (
                <tr key={client.id}>
                  <td className="px-4 py-2 font-medium text-slate-900">{client.name}</td>
                  <td className="px-4 py-2 text-slate-600">{client.contact_name ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-600">{client.email ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-600">{client.phone ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
