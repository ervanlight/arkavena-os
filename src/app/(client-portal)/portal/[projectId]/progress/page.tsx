import { notFound } from 'next/navigation';
import { getClientProjectOverviewAction, listClientTimelineEventsAction } from '@/modules/client-portal';
import { listClientVisibleEvidenceWithUrlsForProjectAction } from '@/modules/evidence';
import { PortalNav } from '../portal-nav';
import { Activity, BarChart2, CheckCircle2, Clock, Image as ImageIcon } from 'lucide-react';

export const metadata = { title: 'Progress — Arkavena OS' };

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
            <p className="text-sm text-gray-500">Progress Detail</p>
          </div>
        </div>
      </div>

      <PortalNav projectId={projectId} active="/progress" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Progress Timeline */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-6">
            <h2 className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <BarChart2 size={16} /> JADWAL &amp; KEMAJUAN TAHAPAN
            </h2>

            {timelineEvents.length === 0 ? (
              <p className="text-sm text-gray-500">Belum ada tahapan jadwal terdaftar.</p>
            ) : (
              <div className="space-y-4">
                {timelineEvents.map((event) => (
                  <div key={event.source_id} className="flex items-center justify-between rounded-lg border border-white/10 bg-[#222] p-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${event.status === 'completed' ? 'bg-green-500/10 text-green-500' : 'bg-gray-800 text-gray-400'}`}>
                        {event.status === 'completed' ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-200">{event.title}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(event.event_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${event.status === 'completed' ? 'bg-green-500/10 text-green-500' : 'bg-gray-800 text-gray-400'}`}>
                      {event.status === 'completed' ? 'Selesai' : 'Terjadwal'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Verified Progress Photos */}
        <div className="space-y-6">
          <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-6">
            <h2 className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <ImageIcon size={16} /> BUKTI FOTO TERVERIFIKASI
            </h2>

            {evidence.length === 0 ? (
              <p className="text-sm text-gray-500">Belum ada foto progres yang diterbitkan.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {evidence.slice(0, 6).map((img) => (
                  <div key={img.id} className="group relative aspect-square overflow-hidden rounded-lg bg-[#2A2A2A]">
                    {img.thumbnailUrl && (
                      <img src={img.thumbnailUrl} alt="Bukti progres" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
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
