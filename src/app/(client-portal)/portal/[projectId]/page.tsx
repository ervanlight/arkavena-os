import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getClientProjectOverviewAction,
  listClientTimelineEventsAction,
  listClientStatusUpdatesForProjectAction,
  listPendingClientDecisionsAction,
} from '@/modules/client-portal';
import { listClientVisibleEvidenceWithUrlsForProjectAction } from '@/modules/evidence';
import { listInvoicesForProjectAction } from '@/modules/billing';
import { formatRp } from '@/core/money/rupiah';
import { PortalNav } from '../portal-nav';
import { DecisionClockBadge } from '../decision-clock-badge';
import { Activity, BarChart2, Clock, CheckCircle, MessageSquare } from 'lucide-react';

export const metadata = { title: 'Beranda — Arkavena OS' };

const CLIENT_STATUS_LABEL_ID: Record<string, string> = {
  on_track: 'In Progress', // Using "In Progress" as in the image instead of 'Berjalan sesuai rencana'
  waiting_client_decision: 'Menunggu keputusan Anda',
  external_dependency: 'Menunggu pihak luar',
  schedule_adjustment: 'Penyesuaian jadwal',
  completed: 'Selesai',
};

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

  const [overviewResult, statusResult, pendingResult, evidenceResult, timelineResult, invoicesResult] = await Promise.all([
    getClientProjectOverviewAction(projectId),
    listClientStatusUpdatesForProjectAction(projectId),
    listPendingClientDecisionsAction(projectId),
    listClientVisibleEvidenceWithUrlsForProjectAction(projectId),
    listClientTimelineEventsAction(projectId),
    listInvoicesForProjectAction(projectId),
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
  
  const allInvoices = invoicesResult.ok ? invoicesResult.data : [];
  
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

  const activeStatusStr = latestStatus ? (CLIENT_STATUS_LABEL_ID[latestStatus.status] ?? latestStatus.status) : 'In Progress';
  const tone = latestStatus ? CLIENT_STATUS_TONE[latestStatus.status] : 'success';
  const statusColor = tone === 'success' ? 'text-green-500' : tone === 'warning' ? 'text-yellow-500' : 'text-blue-500';

  return (
    <div className="space-y-6">
      {/* Header section similar to image */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#2A2A2A]">
            <Activity className="text-gray-400" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">{overview.project_name}</h1>
            <p className="text-sm text-gray-500">ProjectView Demo</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-gray-500">Status</p>
            <p className={`text-sm font-medium ${statusColor}`}>{activeStatusStr}</p>
          </div>
          <button className="rounded-md bg-[#2A2A2A] px-4 py-2 text-sm font-medium text-gray-400 transition-colors hover:text-white hover:bg-[#333]">
            Open Demo
          </button>
        </div>
      </div>

      <PortalNav projectId={projectId} active="" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column */}
        <div className="space-y-6 lg:col-span-2">
          {/* OVERALL PROGRESS */}
          <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-6">
             <h2 className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
               <BarChart2 size={16} /> OVERALL PROGRESS
             </h2>
             <div className="mb-2 flex justify-between text-sm text-gray-400">
               <span>Target: 42%</span>
               <span>Actual: 45%</span>
             </div>
             <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-[#2A2A2A]">
               <div className="h-full bg-gray-400" style={{ width: '45%' }} />
             </div>
             <p className="text-sm text-gray-400">+3% ahead of schedule.</p>
          </div>

          {/* RECENT ACTIVITY */}
          <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-6">
             <h2 className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
               <Clock size={16} /> RECENT ACTIVITY
             </h2>
             
             {recentFeed.length === 0 ? (
               <p className="text-sm text-gray-500">Belum ada pembaruan.</p>
             ) : (
               <div className="space-y-6">
                 {recentFeed.map((item, idx) => (
                   <div key={item.key} className="flex gap-4">
                     <div className="flex flex-col items-center">
                       <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2A2A2A]">
                         {item.icon}
                       </div>
                       {idx < recentFeed.length - 1 && (
                         <div className="mt-2 h-full w-[1px] bg-white/10" />
                       )}
                     </div>
                     <div className="pb-6 pt-1">
                       <p className="text-sm font-medium text-gray-300">{item.text}</p>
                       <p className="text-xs text-gray-500">
                         {item.label} &middot; {new Date(item.at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
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
          <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-6">
             <h2 className="mb-6 text-xs font-semibold uppercase tracking-wider text-gray-500">
               ACTION REQUIRED
             </h2>
             {pendingDecisions.length === 0 ? (
               <p className="text-sm text-gray-500">Tidak ada aksi yang menunggu.</p>
             ) : (
               <div className="space-y-4">
                 {pendingDecisions.map((decision) => (
                   <div key={`decision-${decision.id}`} className="rounded-lg border border-white/10 bg-[#222] p-4">
                     <div className="mb-3 flex items-center justify-between">
                       <span className="text-sm font-medium text-gray-200">
                         {decision.change_order_id ? `Variation Order` : decision.proposal_id ? `Proposal` : `Persetujuan`}
                       </span>
                       <DecisionClockBadge tier={decision.clockTier} />
                     </div>
                     <p className="mb-4 text-sm text-gray-500">
                       {decision.client_summary ?? 'Ada keputusan yang menunggu konfirmasi Anda.'}
                     </p>
                     
                     {decision.change_order_id !== null && (
                       <Link
                         href={`/variations/${decision.change_order_id}/approve`}
                         className="block w-full rounded-md bg-[#333] py-2 text-center text-sm font-medium text-gray-300 transition-colors hover:bg-[#444] hover:text-white"
                       >
                         Review
                       </Link>
                     )}
                     {decision.proposal_id !== null && (
                       <Link
                         href={`/proposals/${decision.proposal_id}/decide`}
                         className="block w-full rounded-md bg-[#333] py-2 text-center text-sm font-medium text-gray-300 transition-colors hover:bg-[#444] hover:text-white"
                       >
                         Review
                       </Link>
                     )}
                     {decision.handover_signoff && (
                       <Link
                         href={`/handover/${decision.id}/accept`}
                         className="block w-full rounded-md bg-[#333] py-2 text-center text-sm font-medium text-gray-300 transition-colors hover:bg-[#444] hover:text-white"
                       >
                         Review
                       </Link>
                     )}
                   </div>
                 ))}
               </div>
             )}
          </div>

          {/* PAYMENT TERMS */}
          <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-6">
             <h2 className="mb-6 text-xs font-semibold uppercase tracking-wider text-gray-500">
               PAYMENT TERMS
             </h2>
             <div className="space-y-4">
               {allInvoices.length === 0 ? (
                 <p className="text-sm text-gray-500">Belum ada tagihan.</p>
               ) : (
                 allInvoices.map((inv, index) => (
                   <div key={inv.id} className="flex items-center justify-between">
                     <span className="text-sm text-gray-400">Termin {index + 1} &mdash; {formatRp(inv.amount)}</span>
                     <span className={`text-sm ${inv.status === 'paid' ? 'text-green-500' : 'text-gray-500'}`}>
                       {inv.status === 'paid' ? 'Paid' : 'Pending'}
                     </span>
                   </div>
                 ))
               )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
