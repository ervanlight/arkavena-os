import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getClientProjectOverviewAction,
  listClientTimelineEventsAction,
  listClientStatusUpdatesForProjectAction,
  listPendingClientDecisionsAction,
} from '@/modules/client-feed';
import { listClientVisibleEvidenceWithUrlsForProjectAction } from '@/modules/evidence';
import { PortalNav } from '../portal-nav';
import { DecisionClockBadge } from '../decision-clock-badge';
import { Activity, Clock, CheckCircle, MessageSquare } from 'lucide-react';

export const metadata = { title: 'Beranda — Arkavena OS' };



const CLIENT_STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'info'> = {
  on_track: 'success',
  waiting_client_decision: 'warning',
  external_dependency: 'warning',
  schedule_adjustment: 'info',
  completed: 'success',
};

const TIMELINE_EVENT_LABEL_ID: Record<string, string> = {
  milestone: 'Termin',
  decision: 'Keputusan',
};

type FeedItem = { key: string; at: string; label: string; text: string; icon: React.ReactNode };

export default async function ClientPortalHomePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const [overviewResult, statusResult, pendingResult, evidenceResult, timelineResult] = await Promise.all([
    getClientProjectOverviewAction(projectId),
    listClientStatusUpdatesForProjectAction(projectId),
    listPendingClientDecisionsAction(projectId),
    listClientVisibleEvidenceWithUrlsForProjectAction(projectId),
    listClientTimelineEventsAction(projectId),
  ]);

  if (!overviewResult.ok) {
    return (
      <p role="alert" className="text-sm text-red-500">
        {overviewResult.error.message}
      </p>
    );
  }
  const overview = overviewResult.data;
  if (overview === null) notFound();

  const statusHistory = statusResult.ok ? statusResult.data : [];
  const latestStatus = statusHistory[0] ?? null;
  const pendingDecisions = pendingResult.ok ? pendingResult.data : [];
  const evidence = evidenceResult.ok ? evidenceResult.data : [];
  const timelineEvents = timelineResult.ok ? timelineResult.data : [];
  

  const recentFeed: FeedItem[] = [
    ...timelineEvents.map((e) => ({
      key: `${e.event_type}-${e.source_id}`,
      at: e.event_at,
      label: TIMELINE_EVENT_LABEL_ID[e.event_type] ?? e.event_type,
      text: e.title,
      icon: <CheckCircle size={16} className="text-gray-400" />
    })),
    ...evidence.map((e) => ({
      key: `evidence-${e.id}`,
      at: e.captured_at,
      label: 'Bukti progres',
      text: 'Foto/bukti progres baru diunggah',
      icon: <Activity size={16} className="text-gray-400" />
    })),
    ...statusHistory.map((s) => ({
      key: `status-${s.id}`,
      at: s.published_at,
      label: 'Status proyek',
      text: s.headline,
      icon: <MessageSquare size={16} className="text-gray-400" />
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 5);

  const tone = latestStatus ? CLIENT_STATUS_TONE[latestStatus.status] : 'success';
  const statusColor = tone === 'success' ? 'text-green-500' : tone === 'warning' ? 'text-yellow-500' : 'text-blue-500';

  return (
    <div className="space-y-6">
      {/* Header section: Project Status Card (Reassurance) */}
      <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-6 lg:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <p className="text-[13px] font-semibold tracking-wider text-gray-500 uppercase mb-2">STATUS PROYEK</p>
            <h1 className="text-2xl lg:text-3xl font-semibold text-white mb-2">{overview.project_name}</h1>
            <div className="flex items-center gap-2 mt-4">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full ${tone === 'success' ? 'bg-green-500/20 text-green-500' : tone === 'warning' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-blue-500/20 text-blue-500'}`}>
                {tone === 'success' ? <CheckCircle size={14} /> : <Activity size={14} />}
              </div>
              <p className={`text-lg font-medium ${statusColor}`}>
                {latestStatus?.headline ?? 'Pekerjaan berjalan sesuai jadwal.'}
              </p>
            </div>
            {latestStatus?.detail && (
              <p className="text-gray-400 mt-2 max-w-2xl text-sm leading-relaxed">
                {latestStatus.detail}
              </p>
            )}
          </div>
          <div className="rounded-lg bg-[#222] border border-white/5 p-4 min-w-[200px]">
            <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">PEMBARUAN BERIKUTNYA</p>
            <p className="text-sm font-medium text-gray-200 flex items-center gap-2">
              <Clock size={14} className="text-blue-400" />
              Setiap Jumat Sore
            </p>
          </div>
        </div>
      </div>

      <PortalNav projectId={projectId} active="" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column */}
        <div className="space-y-6 lg:col-span-2">
          {/* RECENT ACTIVITY (WHAT'S NEW) */}
          <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-6 lg:p-8">
             <h2 className="mb-6 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-gray-500">
               <Clock size={16} /> WHAT'S NEW
             </h2>
             <p className="text-sm text-gray-400 mb-8">
               Pembaruan sejak kunjungan terakhir Anda.
             </p>
             
             {recentFeed.length === 0 ? (
               <div className="rounded-lg border border-white/5 bg-[#222] p-6 text-center">
                 <p className="text-sm text-gray-500">Belum ada pembaruan baru hari ini.</p>
               </div>
             ) : (
               <div className="space-y-8">
                 {recentFeed.map((item, idx) => (
                   <div key={item.key} className="flex gap-4">
                     <div className="flex flex-col items-center">
                       <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2A2A2A] text-white">
                         {item.icon}
                       </div>
                       {idx < recentFeed.length - 1 && (
                         <div className="mt-3 h-full w-[1px] bg-white/10" />
                       )}
                     </div>
                     <div className="pb-2 pt-2">
                       <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">{item.label}</p>
                       <p className="text-[15px] font-medium text-gray-200">{item.text}</p>
                       <p className="mt-1 text-xs text-gray-500">
                         {new Date(item.at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                       </p>
                     </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* ACTION REQUIRED */}
          <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-6 lg:p-8 sticky top-24">
             <h2 className="mb-6 text-[13px] font-semibold uppercase tracking-wider text-gray-500">
               YOUR ACTIONS
             </h2>
             {pendingDecisions.length === 0 ? (
               <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-6 text-center">
                 <CheckCircle size={32} className="mx-auto text-green-500 mb-3 opacity-80" />
                 <p className="text-sm font-medium text-green-400">Tidak ada aksi yang memerlukan perhatian Anda hari ini.</p>
               </div>
             ) : (
               <div className="space-y-4">
                 <div className="mb-4 rounded-lg bg-blue-500/10 p-3 border border-blue-500/20">
                   <p className="text-xs text-blue-400">Terdapat beberapa keputusan yang menunggu persetujuan Anda untuk melanjutkan pekerjaan.</p>
                 </div>
                 {pendingDecisions.map((decision) => (
                   <div key={`decision-${decision.id}`} className="rounded-lg border border-white/10 bg-[#222] p-5 shadow-sm transition-colors hover:border-white/20 hover:bg-[#282828]">
                     <div className="mb-3 flex items-center justify-between">
                       <span className="text-sm font-semibold text-white">
                         {decision.change_order_id ? `Persetujuan Variation` : decision.proposal_id ? `Persetujuan Material` : `Persetujuan Dokumen`}
                       </span>
                       <DecisionClockBadge tier={decision.clockTier} />
                     </div>
                     <p className="mb-5 text-sm text-gray-400 leading-relaxed">
                       {decision.client_summary ?? 'Ada keputusan yang menunggu konfirmasi Anda.'}
                     </p>
                     
                     {decision.change_order_id !== null && (
                       <Link
                         href={`/variations/${decision.change_order_id}/approve`}
                         className="block w-full rounded-md bg-white py-2.5 text-center text-sm font-semibold text-black transition-colors hover:bg-gray-200"
                       >
                         Tinjau Detail
                       </Link>
                     )}
                     {decision.proposal_id !== null && (
                       <Link
                         href={`/proposals/${decision.proposal_id}/decide`}
                         className="block w-full rounded-md bg-white py-2.5 text-center text-sm font-semibold text-black transition-colors hover:bg-gray-200"
                       >
                         Tinjau Detail
                       </Link>
                     )}
                     {decision.handover_signoff && (
                       <Link
                         href={`/handover/${decision.id}/accept`}
                         className="block w-full rounded-md bg-white py-2.5 text-center text-sm font-semibold text-black transition-colors hover:bg-gray-200"
                       >
                         Tinjau Detail
                       </Link>
                     )}
                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
