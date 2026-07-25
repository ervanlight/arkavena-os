import { notFound } from 'next/navigation';
import { getClientProjectOverviewAction } from '@/modules/client-portal';
import { listInvoicesForProjectAction } from '@/modules/billing';
import { formatRp } from '@/core/money/rupiah';
import { PortalNav } from '../../portal-nav';
import { Activity, Wallet, Receipt, CheckCircle } from 'lucide-react';

export const metadata = { title: 'Financial — Arkavena OS' };

export default async function ClientPortalFinancialPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const [overviewResult, invoicesResult] = await Promise.all([
    getClientProjectOverviewAction(projectId),
    listInvoicesForProjectAction(projectId),
  ]);

  if (!overviewResult.ok || overviewResult.data === null) notFound();
  const overview = overviewResult.data;

  const allInvoices = invoicesResult.ok ? invoicesResult.data : [];

  return (
    <div className="space-y-6">
      {/* Header section matching dark reference */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#2A2A2A]">
            <Activity className="text-gray-400" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">{overview.project_name}</h1>
            <p className="text-sm text-gray-500">Ringkasan Pembayaran &amp; Tagihan</p>
          </div>
        </div>
      </div>

      <PortalNav projectId={projectId} active="/financial" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Payment Terms List */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-6 space-y-4">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <Wallet size={16} /> JADWAL TERMIN PEMBAYARAN
            </h2>

            {allInvoices.length === 0 ? (
              <p className="text-sm text-gray-500">Belum ada rincian tagihan termin.</p>
            ) : (
              <div className="space-y-3">
                {allInvoices.map((inv, idx) => (
                  <div key={inv.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-[#222] p-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${inv.status === 'paid' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                        {inv.status === 'paid' ? <CheckCircle size={16} /> : <Receipt size={16} />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-200">Termin {idx + 1} &mdash; {formatRp(inv.amount)}</p>
                        <p className="text-xs text-gray-500">
                          Jatuh Tempo: {new Date(inv.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${inv.status === 'paid' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                      {inv.status === 'paid' ? 'Paid' : 'Pending Payment'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Financial Summary Card */}
        <div className="space-y-6">
          <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-6 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">STATUS PEMBAYARAN</h2>
            <div className="rounded-lg bg-[#222] p-4 space-y-2 border border-white/5">
              <span className="text-xs text-gray-500">Metode Pembayaran Aman</span>
              <p className="text-sm font-semibold text-gray-200">Transfer Bank Resmi Arkavena</p>
              <p className="text-xs text-gray-400 pt-2 border-t border-white/5">
                Setiap pembayaran otomatis terkonfirmasi dan memperbarui status termin Anda secara langsung.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
