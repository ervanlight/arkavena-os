import { notFound } from 'next/navigation';
import { getClientProjectOverviewAction } from '@/modules/client-feed';
import { PortalNav } from '../../portal-nav';
import { Activity, ShieldCheck, Award, FileCheck2 } from 'lucide-react';

export const metadata = { title: 'Quality — Arkavena OS' };

export default async function ClientPortalQualityPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const overviewResult = await getClientProjectOverviewAction(projectId);
  if (!overviewResult.ok || overviewResult.data === null) notFound();
  const overview = overviewResult.data;

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
            <p className="text-sm text-gray-500">Pemeriksaan Mutu &amp; Garansi</p>
          </div>
        </div>
      </div>

      <PortalNav projectId={projectId} active="/quality" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Quality Checkpoints */}
        <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-6 space-y-4">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            <ShieldCheck size={16} className="text-green-500" /> PEMERIKSAAN MUTU INDEPENDEN (QUALITY GATE)
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-[#222] p-4">
              <div className="flex items-center gap-3">
                <FileCheck2 size={18} className="text-green-500" />
                <div>
                  <p className="text-sm font-medium text-gray-200">Uji Kuat Tekan Beton K-300 Pelat Lantai 2</p>
                  <p className="text-xs text-gray-500">Lulus Uji Lab Slump &amp; Compression Test</p>
                </div>
              </div>
              <span className="text-xs font-medium text-green-500 bg-green-500/10 px-2.5 py-1 rounded-full">LULUS</span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-[#222] p-4">
              <div className="flex items-center gap-3">
                <FileCheck2 size={18} className="text-green-500" />
                <div>
                  <p className="text-sm font-medium text-gray-200">Pemeriksaan Kebocoran Pembesihan &amp; Plambing</p>
                  <p className="text-xs text-gray-500">Uji Tekan Pipa Hydrant &amp; Water Supply</p>
                </div>
              </div>
              <span className="text-xs font-medium text-green-500 bg-green-500/10 px-2.5 py-1 rounded-full">LULUS</span>
            </div>
          </div>
        </div>

        {/* Warranties */}
        <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-6 space-y-4">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            <Award size={16} className="text-purple-500" /> SERTIFIKAT &amp; JAMINAN GARANSI
          </h2>
          <div className="rounded-lg border border-white/10 bg-[#222] p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-200">Garansi Pemeliharaan Struktur</span>
              <span className="text-xs font-medium text-purple-400">12 Bulan</span>
            </div>
            <p className="text-xs text-gray-500">Jaminan perbaikan penuh untuk kebocoran &amp; keandalan struktur bangunan pasca serah terima.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
