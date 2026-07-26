import { safeAction } from '@/core/actions/safe-action';
import { getActionContext } from '@/core/auth/session';
import { requirePermission } from '@/core/permissions/guard';
import { listPendingInspections } from '../data/quality-repository';
import { listPendingQuotes } from '../data/quotes-repository';
import type { ReviewInboxItem } from '../types';
import { z } from 'zod';

export const listPendingInboxItemsAction = safeAction(
  {
    schema: z.object({ projectId: z.string().uuid().optional() }).optional().default({}),
    name: 'reviewCenter.listInbox',
    loadContext: getActionContext,
    permission: { resource: 'inspection', action: 'view' },
  },
  async (input, ctx) => {

    const [inspections, quotes] = await Promise.all([
      listPendingInspections(input.projectId),
      listPendingQuotes(input.projectId)
    ]);

    const items: ReviewInboxItem[] = [];

    for (const insp of inspections) {
      items.push({
        id: insp.id,
        type: 'hold_point',
        title: `Persetujuan Mutu: ${(insp as any).hold_point_templates?.name || 'Inspeksi'}`,
        subtitle: `Paket Pekerjaan: ${(insp as any).work_packages?.name || 'TBA'}`,
        status: insp.status,
        submittedAt: insp.created_at,
        projectId: insp.project_id,
        projectName: (insp as any).projects?.name || 'Proyek',
        zoneId: insp.zone_id,
        zoneName: (insp as any).zones?.name || 'Zona',
      });
    }

    for (const q of quotes) {
      items.push({
        id: q.id,
        type: 'subcon_quote',
        title: `RAB Subkontraktor: ${(q as any).vendors?.name || 'Vendor'}`,
        subtitle: q.description,
        status: q.status,
        submittedAt: q.created_at,
        projectId: q.project_id,
        projectName: (q as any).projects?.name || 'Proyek',
        ...(q.amount ? { amountRp: BigInt(q.amount) } : {})
      });
    }

    // Sort newest first
    return { ok: true, data: items.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()) };
  }
);
