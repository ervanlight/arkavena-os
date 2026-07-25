'use server';

import { z } from 'zod';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { getWorkPackage } from '@/modules/projects/server';
import type { WorkPackage } from '@/modules/projects';
import {
  listEvidenceForActivity,
  listClientVisibleEvidenceForProject,
  listClientVisibleEvidenceWithUrlsForProject,
} from '../data/evidence-repository';
import { listOverridesForProject, overrideEvidenceGate } from '../data/evidence-overrides-repository';
import { overrideEvidenceGateSchema } from '../schemas';
import type { Evidence, EvidenceOverrideRow, EvidenceWithUrl } from '../types';

export const listEvidenceForActivityAction = safeAction(
  {
    schema: z.object({ activityTable: z.string(), activityId: z.string().uuid() }),
    permission: { resource: 'evidence', action: 'view' },
    loadContext: getActionContext,
    name: 'evidence.listEvidenceForActivity',
  },
  async ({ activityTable, activityId }): Promise<Evidence[]> => {
    const supabase = await createServerSupabase();
    return listEvidenceForActivity(supabase, activityTable, activityId);
  },
);

/** RLS (evidence_select_client) is what actually decides whether a given signed-in client may see a given project's rows; this permission entry (evidence.view includes client_approver/client_viewer) is what lets requirePermission() pass for a client caller at all, and also lets staff preview the Timeline. */
export const listClientVisibleEvidenceForProjectAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'evidence', action: 'view' },
    loadContext: getActionContext,
    name: 'evidence.listClientVisibleEvidenceForProject',
    audience: 'external',
  },
  async (projectId): Promise<Evidence[]> => {
    const supabase = await createServerSupabase();
    return listClientVisibleEvidenceForProject(supabase, projectId);
  },
);

/** Same read as above, with thumbnail URLs resolved -- the Client Timeline's actual data source (ADR 0026 §4.2). */
export const listClientVisibleEvidenceWithUrlsForProjectAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'evidence', action: 'view' },
    loadContext: getActionContext,
    name: 'evidence.listClientVisibleEvidenceWithUrlsForProject',
    audience: 'external',
  },
  async (projectId): Promise<EvidenceWithUrl[]> => {
    const supabase = await createServerSupabase();
    return listClientVisibleEvidenceWithUrlsForProject(supabase, projectId);
  },
);

export const listEvidenceOverridesForProjectAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'evidence_override', action: 'view' },
    loadContext: getActionContext,
    name: 'evidence.listOverridesForProject',
  },
  async (projectId): Promise<EvidenceOverrideRow[]> => {
    const supabase = await createServerSupabase();
    return listOverridesForProject(supabase, projectId);
  },
);

/**
 * The one path that unblocks a work package with no qualifying evidence
 * (ADR 0029 Decision 1). RLS lets any staff member's row through and
 * trg_evidence_overrides_guard_td_only is the real authority, but
 * requirePermission() below (evidence_override.create -> technical_director
 * only) gives a friendly Indonesian refusal before the request ever reaches
 * the database for anyone else.
 */
export const overrideEvidenceGateAction = safeAction(
  {
    schema: overrideEvidenceGateSchema,
    permission: { resource: 'evidence_override', action: 'create' },
    loadContext: getActionContext,
    name: 'evidence.overrideEvidenceGate',
  },
  async (input, ctx): Promise<WorkPackage> => {
    const supabase = await createServerSupabase();
    const before = await getWorkPackage(supabase, input.workPackageId);
    const after = await overrideEvidenceGate(supabase, input.workPackageId, input.reason);

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'work_packages',
      entityId: after.id,
      action: 'override',
      reason: input.reason,
      previousValue: { status: before.status },
      newValue: { status: after.status },
      projectId: after.project_id,
      requestId: ctx.requestId,
    });

    return after;
  },
);
