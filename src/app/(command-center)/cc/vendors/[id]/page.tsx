import { notFound } from 'next/navigation';
import { getVendorAction } from '@/modules/procurement';
import { listProjectsAction } from '@/modules/projects';
import { InviteVendorUserForm } from './invite-vendor-user-form';

export const metadata = { title: 'Detail vendor — BuildTrust OS' };

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [vendorResult, projectsResult] = await Promise.all([getVendorAction(id), listProjectsAction(undefined)]);

  if (!vendorResult.ok) {
    if (vendorResult.error.code === 'NOT_FOUND') notFound();
    return (
      <p role="alert" className="text-sm text-red-600">
        {vendorResult.error.message}
      </p>
    );
  }

  const vendor = vendorResult.data;
  const projects = projectsResult.ok ? projectsResult.data : [];

  return (
    <div className="space-y-8">
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">{vendor.name}</h1>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-slate-500">Kontak</dt>
          <dd className="text-slate-900">{vendor.contact_name ?? '—'}</dd>
          <dt className="text-slate-500">Email</dt>
          <dd className="text-slate-900">{vendor.email ?? '—'}</dd>
          <dt className="text-slate-500">Telepon</dt>
          <dd className="text-slate-900">{vendor.phone ?? '—'}</dd>
        </dl>
      </div>

      <div className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Akses Partner Desk</h2>
        <p className="text-sm text-slate-500">
          Undang kontak vendor ini untuk masuk ke Partner Desk (/partner) dan melihat penawaran, purchase order, dan
          pengiriman miliknya sendiri untuk satu proyek.
        </p>
        <InviteVendorUserForm vendorId={vendor.id} projects={projects} />
      </div>
    </div>
  );
}
