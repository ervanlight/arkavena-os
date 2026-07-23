import type { Route } from 'next';
import Link from 'next/link';
import { listVendorsAction } from '@/modules/procurement';

export const metadata = { title: 'Vendor — BuildTrust OS' };

export default async function VendorsPage() {
  const result = await listVendorsAction(undefined);
  const vendors = result.ok ? result.data : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Vendor</h1>
        <Link
          href="/cc/vendors/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Tambah vendor
        </Link>
      </div>

      {!result.ok && (
        <p role="alert" className="text-sm text-red-600">
          {result.error.message}
        </p>
      )}

      {result.ok && vendors.length === 0 && <p className="text-sm text-slate-500">Belum ada vendor.</p>}

      {vendors.length > 0 && (
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
              {vendors.map((vendor) => (
                <tr key={vendor.id}>
                  <td className="px-4 py-2 font-medium text-slate-900">
                    <Link href={`/cc/vendors/${vendor.id}` as Route} className="underline">
                      {vendor.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{vendor.contact_name ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-600">{vendor.email ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-600">{vendor.phone ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
