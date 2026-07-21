import type { Zone } from '../types';

/**
 * ZoneMap v1 (ARCHITECTURE.md 7, Fase 1 exit criteria): a static layout of a
 * project's zones, not yet an interactive floor plan. There is no
 * positioning, no drag-and-drop, no coordinates -- a zone is a named area
 * (ARCHITECTURE.md's own example: "Lantai 1", "Zona A"), and this renders
 * that list as a simple grid rather than a form. Later phases (field-reporting
 * attaches photos and progress per zone) are what eventually justify an
 * actual floor plan with real positions; nothing about this component design
 * should make that harder to add, but nothing here builds it ahead of time
 * either (CLAUDE.md law 7).
 */
export function ZoneMap({ zones }: { zones: Zone[] }) {
  if (zones.length === 0) {
    return <p className="text-sm text-slate-500">Belum ada zona untuk proyek ini.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {zones.map((zone) => (
        <div key={zone.id} className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="font-medium text-slate-900">{zone.name}</p>
          {zone.description !== null && <p className="mt-1 text-xs text-slate-500">{zone.description}</p>}
        </div>
      ))}
    </div>
  );
}
