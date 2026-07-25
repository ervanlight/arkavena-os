import { listClientZoneProgressAction } from '@/modules/client-portal';
import { PortalNav } from '../../portal-nav';
import { Card, EmptyState } from '@/core/ui';

export const metadata = { title: 'Peta Zona — Arkavena OS' };

export default async function ClientPortalZonePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const result = await listClientZoneProgressAction(projectId);
  const zones = result.ok ? result.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[19px] font-semibold text-[color:var(--color-ink)]">Peta Zona</h1>
        <PortalNav projectId={projectId} active="/zona" />
      </div>

      {zones.length === 0 ? (
        <EmptyState title="Belum ada zona" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {zones.map((zone) => (
            <Card key={zone.zone_id}>
              <h2 className="text-[15px] font-semibold text-[color:var(--color-ink)]">{zone.zone_name}</h2>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-2 flex-1 rounded-full bg-[color:var(--color-surface-secondary)]">
                  <div
                    className="h-2 rounded-full bg-[color:var(--color-success)]"
                    style={{ width: `${zone.progress_percent}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-[color:var(--color-ink-secondary)]">{zone.progress_percent}%</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
