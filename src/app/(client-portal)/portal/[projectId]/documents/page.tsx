import { notFound } from 'next/navigation';
import { getClientProjectOverviewAction } from '@/modules/client-feed';
import { listInvoicesForProjectAction } from '@/modules/invoice-generator';
import { formatRp } from '@/core/money/rupiah';
import { PortalNav } from '../../portal-nav';
import { Activity, Wallet, Receipt, CheckCircle, FileText, Download, ShieldCheck, FolderArchive } from 'lucide-react';

export const metadata = { title: 'Dokumen & Tagihan — Arkavena OS' };

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
            <p className="text-sm text-gray-500">Pusat Dokumen &amp; Tagihan Resmi</p>
          </div>
        </div>
      </div>

      <PortalNav projectId={projectId} active="/documents" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Payment Terms List */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-6 lg:p-8 space-y-4">
            <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-gray-500 mb-6">
              <Wallet size={16} /> TAGIHAN (INVOICES)
            </h2>

            {allInvoices.length === 0 ? (
              <div className="rounded-lg border border-white/5 bg-[#222] p-6 text-center">
                <p className="text-sm text-gray-500">Belum ada rincian tagihan termin.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {allInvoices.map((inv, idx) => (
                  <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-white/10 bg-[#222] p-5 gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${inv.status === 'paid' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                        {inv.status === 'paid' ? <CheckCircle size={20} /> : <Receipt size={20} />}
                      </div>
                      <div>
                        <p className="text-[15px] font-semibold text-gray-200">
                          Termin {idx + 1} &mdash; {idx === 0 ? 'Pekerjaan Pondasi Selesai' : 'Pekerjaan Atap Selesai'}
                        </p>
                        <p className="text-sm text-white font-medium my-1">{formatRp(inv.amount)}</p>
                        <p className="text-xs text-gray-500">
                          Jatuh Tempo: {new Date(inv.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-3 w-full sm:w-auto">
                      <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${inv.status === 'paid' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/20 text-yellow-500'}`}>
                        {inv.status === 'paid' ? 'LUNAS' : 'MENUNGGU PEMBAYARAN'}
                      </span>
                      <button className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 text-xs font-medium text-white bg-white/10 hover:bg-white/20 rounded-md transition-colors">
                        <Download size={14} /> Unduh PDF
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Financial Summary Card */}
        <div className="space-y-6">
          <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-6 lg:p-8 space-y-4 sticky top-24">
            <h2 className="text-[13px] font-semibold uppercase tracking-wider text-gray-500 mb-6 flex items-center gap-2">
              <FolderArchive size={16} /> DOKUMEN PROYEK
            </h2>
            
            <div className="space-y-3">
              <button className="w-full flex items-center justify-between p-4 rounded-lg border border-white/5 bg-[#222] hover:bg-[#2A2A2A] transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-blue-500/10 rounded flex items-center justify-center text-blue-500">
                    <FileText size={20} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-200">Kontrak Utama</p>
                    <p className="text-xs text-gray-500">Ditandatangani 12 Jan 2026</p>
                  </div>
                </div>
                <Download size={16} className="text-gray-500 group-hover:text-white transition-colors" />
              </button>
              
              <button className="w-full flex items-center justify-between p-4 rounded-lg border border-white/5 bg-[#222] hover:bg-[#2A2A2A] transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-purple-500/10 rounded flex items-center justify-center text-purple-500">
                    <ShieldCheck size={20} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-200">Dokumen Garansi</p>
                    <p className="text-xs text-gray-500">Aktif setelah Serah Terima</p>
                  </div>
                </div>
                <Download size={16} className="text-gray-500 group-hover:text-white transition-colors" />
              </button>
            </div>
            
            <div className="mt-6 rounded-lg bg-blue-500/10 p-4 border border-blue-500/20">
              <span className="text-xs font-semibold text-blue-400 block mb-1">Penyimpanan Aman</span>
              <p className="text-xs text-blue-200/80 leading-relaxed">
                Semua dokumen proyek Anda tersimpan secara permanen dan aman di Arkavena OS. Anda dapat mengunduhnya kapan saja.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
