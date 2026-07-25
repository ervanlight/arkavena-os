'use server';

import { z } from 'zod';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { getLeadAction, getSiteAction, type Lead, type Site } from '@/modules/crm';
import {
  getAssessment,
  insertAssessment,
  listAssessments,
  listAssessmentsForSite,
  updateAssessment,
} from '../data/assessments-repository';
import { completeAssessmentSchema, createAssessmentSchema, updateAssessmentFindingsSchema } from '../schemas';
import type { Assessment } from '../types';

export const createAssessmentAction = safeAction(
  {
    schema: createAssessmentSchema,
    permission: { resource: 'assessment', action: 'create' },
    loadContext: getActionContext,
    name: 'assessment.createAssessment',
  },
  async (input, ctx): Promise<Assessment> => {
    const supabase = await createServerSupabase();
    const assessment = await insertAssessment(supabase, {
      organization_id: ctx.organizationId,
      site_id: input.siteId,
      lead_id: input.leadId ?? null,
      site_conditions: input.siteConditions ?? null,
      recommended_scope: input.recommendedScope ?? null,
      notes: input.notes ?? null,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'assessments',
      entityId: assessment.id,
      action: 'insert',
      newValue: assessment,
      requestId: ctx.requestId,
    });

    return assessment;
  },
);

export const updateAssessmentFindingsAction = safeAction(
  {
    schema: updateAssessmentFindingsSchema,
    permission: { resource: 'assessment', action: 'update' },
    loadContext: getActionContext,
    name: 'assessment.updateAssessmentFindings',
  },
  async (input, ctx): Promise<Assessment> => {
    const supabase = await createServerSupabase();
    const before = await getAssessment(supabase, input.id);

    const after = await updateAssessment(supabase, input.id, {
      ...(input.siteConditions !== undefined ? { site_conditions: input.siteConditions } : {}),
      ...(input.recommendedScope !== undefined ? { recommended_scope: input.recommendedScope } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.checklistResponses !== undefined ? { checklist_responses: input.checklistResponses } : {}),
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'assessments',
      entityId: after.id,
      action: 'update',
      previousValue: before,
      newValue: after,
      requestId: ctx.requestId,
    });

    return after;
  },
);

/**
 * Sets `assessed_by`/`assessed_at` from the acting user, never from client
 * input -- ck_assessments_completed_requires_assessor is what actually
 * enforces "completed needs both", this just guarantees they are always the
 * real actor and the real time (ARCHITECTURE.md 0.5's "server sets what the
 * audit trail must trust").
 */
export const completeAssessmentAction = safeAction(
  {
    schema: completeAssessmentSchema,
    permission: { resource: 'assessment', action: 'complete' },
    loadContext: getActionContext,
    name: 'assessment.completeAssessment',
  },
  async (input, ctx): Promise<Assessment> => {
    const supabase = await createServerSupabase();
    const before = await getAssessment(supabase, input.id);

    const after = await updateAssessment(supabase, input.id, {
      status: 'completed',
      assessed_by: ctx.userId,
      assessed_at: new Date().toISOString(),
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'assessments',
      entityId: after.id,
      action: 'status_change',
      previousValue: before,
      newValue: after,
      requestId: ctx.requestId,
    });

    return after;
  },
);

export const listAssessmentsAction = safeAction(
  {
    schema: z.void(),
    permission: { resource: 'assessment', action: 'view' },
    loadContext: getActionContext,
    name: 'assessment.listAssessments',
  },
  async (): Promise<Assessment[]> => {
    const supabase = await createServerSupabase();
    return listAssessments(supabase);
  },
);

export const listAssessmentsForSiteAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'assessment', action: 'view' },
    loadContext: getActionContext,
    name: 'assessment.listAssessmentsForSite',
  },
  async (siteId): Promise<Assessment[]> => {
    const supabase = await createServerSupabase();
    return listAssessmentsForSite(supabase, siteId);
  },
);

export const getAssessmentAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'assessment', action: 'view' },
    loadContext: getActionContext,
    name: 'assessment.getAssessment',
  },
  async (id): Promise<Assessment> => {
    const supabase = await createServerSupabase();
    return getAssessment(supabase, id);
  },
);

export type AssessmentReport = {
  readonly assessment: Assessment;
  readonly site: Site;
  readonly lead: Lead | null;
};

/**
 * The "report generator" (ADR 0018 SS3): request-time assembly of assessment
 * + site + lead data, no separate stored document -- same shape billing's
 * own pack already established (ADR 0017 SS4). Reaches modules/crm only
 * through its public actions (getSiteAction, getLeadAction), never its
 * repositories (ARCHITECTURE.md 1.2).
 */
export const getAssessmentReportAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'assessment', action: 'view' },
    loadContext: getActionContext,
    name: 'assessment.getAssessmentReport',
  },
  async (id): Promise<AssessmentReport> => {
    const supabase = await createServerSupabase();
    const assessment = await getAssessment(supabase, id);

    const siteResult = await getSiteAction(assessment.site_id);
    if (!siteResult.ok) {
      throw new Error(`Failed to load site for assessment report ${assessment.id}: ${siteResult.error.message}`);
    }

    let lead: Lead | null = null;
    if (assessment.lead_id !== null) {
      const leadResult = await getLeadAction(assessment.lead_id);
      if (!leadResult.ok) {
        throw new Error(`Failed to load lead for assessment report ${assessment.id}: ${leadResult.error.message}`);
      }
      lead = leadResult.data;
    }

    return { assessment, site: siteResult.data, lead };
  },
);
