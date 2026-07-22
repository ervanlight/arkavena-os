'use server';

import { z } from 'zod';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { decisionClockTier, type DecisionClockTier } from '../domain/decision-clock';
import {
  listClientDecisionsForProject,
  listPendingClientDecisionsForProject,
} from '../data/client-decisions-repository';
import {
  getClientProjectOverview,
  listClientProgressPhotos,
  listClientTimelineEvents,
  listClientZoneProgress,
} from '../data/client-views-repository';
import type {
  ClientDecision,
  ClientProgressPhoto,
  ClientProjectOverview,
  ClientTimelineEvent,
  ClientZoneProgress,
} from '../types';

/**
 * These four read the vw_client_* views (ADR 0016) with no `permission`
 * entry -- the same "available to any signed-in user" shape as
 * listMyFieldProjectsAction: real access control is RLS on the underlying
 * tables (security_invoker views), scoped by fn_has_project_role. A caller
 * with no access to a project simply gets an empty/null result back, never
 * another project's data -- there is nothing a matrix check here would add.
 */

export const getClientProjectOverviewAction = safeAction(
  {
    schema: z.string().uuid(),
    loadContext: getActionContext,
    name: 'clientPortal.getClientProjectOverview',
  },
  async (projectId): Promise<ClientProjectOverview | null> => {
    const supabase = await createServerSupabase();
    return getClientProjectOverview(supabase, projectId);
  },
);

export const listClientZoneProgressAction = safeAction(
  {
    schema: z.string().uuid(),
    loadContext: getActionContext,
    name: 'clientPortal.listClientZoneProgress',
  },
  async (projectId): Promise<ClientZoneProgress[]> => {
    const supabase = await createServerSupabase();
    return listClientZoneProgress(supabase, projectId);
  },
);

export const listClientTimelineEventsAction = safeAction(
  {
    schema: z.string().uuid(),
    loadContext: getActionContext,
    name: 'clientPortal.listClientTimelineEvents',
  },
  async (projectId): Promise<ClientTimelineEvent[]> => {
    const supabase = await createServerSupabase();
    return listClientTimelineEvents(supabase, projectId);
  },
);

export const listClientProgressPhotosAction = safeAction(
  {
    schema: z.string().uuid(),
    loadContext: getActionContext,
    name: 'clientPortal.listClientProgressPhotos',
  },
  async (projectId): Promise<ClientProgressPhoto[]> => {
    const supabase = await createServerSupabase();
    return listClientProgressPhotos(supabase, projectId);
  },
);

export const listClientDecisionsAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'client_decision', action: 'view' },
    loadContext: getActionContext,
    name: 'clientPortal.listClientDecisions',
  },
  async (projectId): Promise<ClientDecision[]> => {
    const supabase = await createServerSupabase();
    return listClientDecisionsForProject(supabase, projectId);
  },
);

/** Pending decisions with their Decision Clock tier attached, for the portal's "awaiting your decision" section. */
export const listPendingClientDecisionsAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'client_decision', action: 'view' },
    loadContext: getActionContext,
    name: 'clientPortal.listPendingClientDecisions',
  },
  async (projectId): Promise<(ClientDecision & { clockTier: DecisionClockTier })[]> => {
    const supabase = await createServerSupabase();
    const pending = await listPendingClientDecisionsForProject(supabase, projectId);
    const now = Date.now();
    return pending.map((decision) => ({
      ...decision,
      clockTier: decisionClockTier(new Date(decision.presented_at).getTime(), now),
    }));
  },
);
