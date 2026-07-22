import { listClientZoneProgressAction } from '@/modules/client-portal';
import { PortalNav } from '../../portal-nav';

export const metadata = { title: 'Peta Zona — BuildTrust OS' };

export default async function ClientPortalZonePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const result = await listClientZoneProgressAction(projectId);
  const zones = result.ok ? result.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Peta Zona</h1>
        <PortalNav projectId={projectId} active="/zona" />
      </div>

      {zones.length === 0 && <p className="text-sm text-slate-500">Belum ada zona.</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {zones.map((zone) => (
          <div key={zone.zone_id} className="rounded-lg bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">{zone.zone_name}</h2>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-2 flex-1 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${zone.progress_percent}%` }} />
              </div>
              <span className="text-sm font-medium text-slate-700">{zone.progress_percent}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
