import { notFound } from 'next/navigation';
import { getClientProjectOverviewAction, listClientTimelineEventsAction } from '@/modules/client-feed';
import { listClientVisibleEvidenceWithUrlsForProjectAction } from '@/modules/evidence';
import { PortalNav } from '../../portal-nav';
import { Activity, CheckCircle2, Clock, Image as ImageIcon, MapPin } from 'lucide-react';
import { PhotoGallery } from './photo-gallery';

export const metadata = { title: 'Timeline & Progress — Arkavena OS' };

export default async function ClientPortalProgressPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const [overviewResult, timelineResult, evidenceResult] = await Promise.all([
    getClientProjectOverviewAction(projectId),
    listClientTimelineEventsAction(projectId),
    listClientVisibleEvidenceWithUrlsForProjectAction(projectId),
  ]);

  if (!overviewResult.ok || overviewResult.data === null) notFound();
  const overview = overviewResult.data;

  const timelineEvents = timelineResult.ok ? timelineResult.data : [];
  const evidence = evidenceResult.ok ? evidenceResult.data : [];

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
            <p className="text-sm text-gray-500">Timeline &amp; Milestone Proyek</p>
          </div>
        </div>
      </div>

      <PortalNav projectId={projectId} active="/timeline" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Progress Timeline */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-6 lg:p-8">
            <h2 className="mb-8 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-gray-500">
              <MapPin size={16} /> PERJALANAN PROYEK (MILESTONES)
            </h2>

            {timelineEvents.length === 0 ? (
              <div className="rounded-lg border border-white/5 bg-[#222] p-6 text-center">
                <p className="text-sm text-gray-500">Belum ada tahapan jadwal terdaftar.</p>
              </div>
            ) : (
              <div className="relative border-l border-white/10 ml-4 space-y-8 pb-4">
                {timelineEvents.map((event) => (
                  <div key={event.source_id} className="relative pl-6">
                    <div className={`absolute -left-3.5 top-0.5 flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-[#1A1A1A] ${event.status === 'completed' ? 'bg-green-500 text-white' : 'bg-gray-800 text-gray-400'}`}>
                      {event.status === 'completed' ? <CheckCircle2 size={12} strokeWidth={3} /> : <Clock size={12} />}
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className={`text-[15px] font-semibold ${event.status === 'completed' ? 'text-white' : 'text-gray-300'}`}>{event.title}</p>
                        <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${event.status === 'completed' ? 'bg-green-500/10 text-green-500' : 'bg-gray-800 text-gray-400'}`}>
                          {event.status === 'completed' ? 'Selesai' : 'Terjadwal'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {new Date(event.event_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Verified Progress Photos */}
        <div className="space-y-6">
          <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-6 lg:p-8">
            <h2 className="mb-6 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-gray-500">
              <ImageIcon size={16} /> DOKUMENTASI LAPANGAN
            </h2>
            <p className="text-sm text-gray-400 mb-6">
              Foto kondisi lapangan terbaru yang telah diverifikasi.
            </p>

            <PhotoGallery images={evidence} />
          </div>
        </div>
      </div>
    </div>
  );
}
