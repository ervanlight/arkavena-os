import { Users } from 'lucide-react';
import { Card, EmptyState } from '@/core/ui';
import { listVendorsAction } from '@/modules/subcontractors';

export const metadata = { title: 'Subkontraktor — Arkavena OS' };

export default async function SubcontractorsPage() {
  const result = await listVendorsAction(undefined);
  const vendors = result.ok ? result.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">Direktori Subkontraktor &amp; Vendor</h1>
        <p className="text-sm text-[color:var(--color-ink-secondary)]">
          Kelola mitra kerja, rilis Work Order, tinjau performa, dan kontrol pengajuan RAB.
        </p>
      </div>

      {vendors.length === 0 ? (
        <EmptyState
          title="Belum ada Vendor"
          description="Anda belum menambahkan Vendor atau Subkontraktor apa pun ke dalam direktori."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vendors.map((vendor) => (
            <Card key={vendor.id} className="border border-[color:var(--color-hairline)] p-5 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Users size={18} className="text-purple-600" />
                    <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">{vendor.name}</h2>
                  </div>
                  <span className="text-xs font-semibold text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full">
                    Terdaftar
                  </span>
                </div>
                {vendor.contact_name && (
                  <p className="text-xs text-[color:var(--color-ink-secondary)] mt-2">
                    Kontak: {vendor.contact_name} {vendor.phone ? `(${vendor.phone})` : ''}
                  </p>
                )}
                {vendor.notes && (
                  <p className="text-xs text-[color:var(--color-ink-tertiary)] mt-1 line-clamp-2">
                    {vendor.notes}
                  </p>
                )}
              </div>
              <div className="flex justify-between items-center pt-2 text-xs border-t border-[color:var(--color-hairline)] mt-3">
                <span className="text-[color:var(--color-ink-tertiary)]">Terdaftar: {new Date(vendor.created_at).toLocaleDateString('id-ID')}</span>
                <button className="rounded-lg border border-[color:var(--color-hairline)] px-2.5 py-1 font-medium text-[color:var(--color-ink)] hover:bg-gray-50">
                  Lihat Detail
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
