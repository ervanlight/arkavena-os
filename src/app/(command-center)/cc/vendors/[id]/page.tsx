import { notFound } from 'next/navigation';
import { getVendorAction } from '@/modules/procurement';
import { listProjectsAction } from '@/modules/projects';
import { Card } from '@/core/ui';
import { InviteVendorUserForm } from './invite-vendor-user-form';

export const metadata = { title: 'Detail vendor — Arkavena OS' };

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [vendorResult, projectsResult] = await Promise.all([getVendorAction(id), listProjectsAction(undefined)]);

  if (!vendorResult.ok) {
    if (vendorResult.error.code === 'NOT_FOUND') notFound();
    return (
      <p role="alert" className="text-sm text-[color:var(--color-danger)]">
        {vendorResult.error.message}
      </p>
    );
  }

  const vendor = vendorResult.data;
  const projects = projectsResult.ok ? projectsResult.data : [];

  return (
    <div className="space-y-8">
      <Card>
        <h1 className="text-[19px] font-semibold text-[color:var(--color-ink)]">{vendor.name}</h1>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-[color:var(--color-ink-tertiary)]">Kontak</dt>
          <dd className="text-[color:var(--color-ink)]">{vendor.contact_name ?? '—'}</dd>
          <dt className="text-[color:var(--color-ink-tertiary)]">Email</dt>
          <dd className="text-[color:var(--color-ink)]">{vendor.email ?? '—'}</dd>
          <dt className="text-[color:var(--color-ink-tertiary)]">Telepon</dt>
          <dd className="text-[color:var(--color-ink)]">{vendor.phone ?? '—'}</dd>
        </dl>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Akses Partner Desk</h2>
        <p className="text-sm text-[color:var(--color-ink-secondary)]">
          Undang kontak vendor ini untuk masuk ke Partner Desk (/partner) dan melihat penawaran, purchase order, dan
          pengiriman miliknya sendiri untuk satu proyek.
        </p>
        <InviteVendorUserForm vendorId={vendor.id} projects={projects} />
      </Card>
    </div>
  );
}
