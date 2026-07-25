'use server';

import { z } from 'zod';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { DomainRuleError } from '@/core/errors/app-error';
import { ERROR_CODES } from '@/core/errors/codes';
import { getProposal, insertProposal, listProposalsForProject, updateProposal } from '../data/proposals-repository';
import { updateEstimate } from '../data/estimates-repository';
import { createProposalSchema, decideProposalSchema, sendProposalSchema } from '../schemas';
import type { Proposal } from '../types';

export const createProposalAction = safeAction(
  {
    schema: createProposalSchema,
    permission: { resource: 'proposal', action: 'create' },
    loadContext: getActionContext,
    name: 'estimating.createProposal',
  },
  async (input, ctx): Promise<Proposal> => {
    const supabase = await createServerSupabase();
    const proposal = await insertProposal(supabase, {
      organization_id: ctx.organizationId,
      project_id: input.projectId,
      estimate_id: input.estimateId,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'proposals',
      entityId: proposal.id,
      action: 'insert',
      newValue: proposal,
      projectId: proposal.project_id,
      requestId: ctx.requestId,
    });

    return proposal;
  },
);

/**
 * Marks the proposal sent and moves its estimate's own status in step
 * (estimate_status and proposal_status are deliberately parallel enums,
 * ADR 0018 SS4-SS5) -- both writes are sequential awaits within this one
 * action, the same "action-layer sequencing is the transaction" convention
 * every other multi-write action in this codebase already uses (a true
 * cross-table atomic RPC is reserved for cases with a real race condition
 * to close, like fn_set_baseline_estimate's uniqueness constraint).
 */
export const sendProposalAction = safeAction(
  {
    schema: sendProposalSchema,
    permission: { resource: 'proposal', action: 'send' },
    loadContext: getActionContext,
    name: 'estimating.sendProposal',
  },
  async (input, ctx): Promise<Proposal> => {
    const supabase = await createServerSupabase();
    const before = await getProposal(supabase, input.id);

    if (before.status !== 'draft') {
      throw new DomainRuleError(
        ERROR_CODES.PROPOSAL_INVALID_TRANSITION,
        `Proposal ${before.id} is status ${before.status}, not draft`,
        { meta: { proposalId: before.id, status: before.status } },
      );
    }

    const after = await updateProposal(supabase, input.id, {
      status: 'sent',
      sent_at: new Date().toISOString(),
      client_summary: input.clientSummary ?? null,
    });
    await updateEstimate(supabase, after.estimate_id, { status: 'sent' });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'proposals',
      entityId: after.id,
      action: 'status_change',
      previousValue: before,
      newValue: after,
      projectId: after.project_id,
      requestId: ctx.requestId,
    });

    return after;
  },
);

export const decideProposalAction = safeAction(
  {
    schema: decideProposalSchema,
    permission: { resource: 'proposal', action: 'decide' },
    loadContext: getActionContext,
    name: 'estimating.decideProposal',
  },
  async (input, ctx): Promise<Proposal> => {
    const supabase = await createServerSupabase();
    const before = await getProposal(supabase, input.id);

    if (before.status !== 'sent') {
      throw new DomainRuleError(
        ERROR_CODES.PROPOSAL_INVALID_TRANSITION,
        `Proposal ${before.id} is status ${before.status}, not sent`,
        { meta: { proposalId: before.id, status: before.status } },
      );
    }

    const after = await updateProposal(supabase, input.id, {
      status: input.decision,
      decided_at: new Date().toISOString(),
      decided_by: ctx.userId,
      decision_reason: input.reason,
    });
    await updateEstimate(supabase, after.estimate_id, { status: input.decision });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'proposals',
      entityId: after.id,
      action: 'status_change',
      reason: input.reason,
      previousValue: before,
      newValue: after,
      projectId: after.project_id,
      requestId: ctx.requestId,
    });

    return after;
  },
);

/**
 * A client_approver deciding on their own behalf -- distinct from
 * decideProposalAction (staff recording a decision made outside the
 * system), same split as scope-variation's decide vs client_approve/
 * client_reject. RLS (proposals_update_client) and
 * trg_proposals_guard_client_columns are the real enforcement underneath;
 * this permission entry (proposal.client_decide -> client_approver only) is
 * what gives a friendly Indonesian refusal to anyone else before the
 * request ever reaches the database.
 */
export const clientDecideProposalAction = safeAction(
  {
    schema: decideProposalSchema,
    permission: { resource: 'proposal', action: 'client_decide' },
    loadContext: getActionContext,
    name: 'estimating.clientDecideProposal',
    audience: 'external',
  },
  async (input, ctx): Promise<Proposal> => {
    const supabase = await createServerSupabase();
    const before = await getProposal(supabase, input.id);

    if (before.status !== 'sent') {
      throw new DomainRuleError(
        ERROR_CODES.PROPOSAL_INVALID_TRANSITION,
        `Proposal ${before.id} is status ${before.status}, not sent`,
        { meta: { proposalId: before.id, status: before.status } },
      );
    }

    const after = await updateProposal(supabase, input.id, {
      status: input.decision,
      decided_at: new Date().toISOString(),
      decided_by: ctx.userId,
      decision_reason: input.reason,
    });
    await updateEstimate(supabase, after.estimate_id, { status: input.decision });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'proposals',
      entityId: after.id,
      action: input.decision === 'accepted' ? 'approve' : 'reject',
      reason: input.reason,
      previousValue: { status: before.status },
      newValue: { status: after.status },
      projectId: after.project_id,
      requestId: ctx.requestId,
    });

    return after;
  },
);

export const listProposalsForProjectAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'proposal', action: 'view' },
    loadContext: getActionContext,
    name: 'estimating.listProposalsForProject',
  },
  async (projectId): Promise<Proposal[]> => {
    const supabase = await createServerSupabase();
    return listProposalsForProject(supabase, projectId);
  },
);

export const getProposalAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'proposal', action: 'view' },
    loadContext: getActionContext,
    name: 'estimating.getProposal',
  },
  async (id): Promise<Proposal> => {
    const supabase = await createServerSupabase();
    return getProposal(supabase, id);
  },
);
