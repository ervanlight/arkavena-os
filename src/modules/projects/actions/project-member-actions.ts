'use server';

import { z } from 'zod';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import {
  deleteProjectMember,
  getProjectMember,
  insertProjectMember,
  listProjectMembers,
} from '../data/project-members-repository';
import { addProjectMemberSchema, removeProjectMemberSchema } from '../schemas';
import type { ProjectMember } from '../types';

export const addProjectMemberAction = safeAction(
  {
    schema: addProjectMemberSchema,
    permission: { resource: 'project_member', action: 'add' },
    loadContext: getActionContext,
    name: 'projects.addProjectMember',
  },
  async (input, ctx): Promise<ProjectMember> => {
    const supabase = await createServerSupabase();
    const member = await insertProjectMember(supabase, {
      project_id: input.projectId,
      user_id: input.userId,
      project_role: input.projectRole,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'project_members',
      entityId: member.id,
      action: 'insert',
      newValue: member,
      projectId: input.projectId,
      requestId: ctx.requestId,
    });

    return member;
  },
);

export const removeProjectMemberAction = safeAction(
  {
    schema: removeProjectMemberSchema,
    permission: { resource: 'project_member', action: 'remove' },
    loadContext: getActionContext,
    name: 'projects.removeProjectMember',
  },
  async (input, ctx): Promise<null> => {
    const supabase = await createServerSupabase();
    const member = await getProjectMember(supabase, input.id);
    await deleteProjectMember(supabase, input.id);

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'project_members',
      entityId: member.id,
      action: 'delete',
      previousValue: member,
      projectId: member.project_id,
      requestId: ctx.requestId,
    });

    return null;
  },
);

export const listProjectMembersAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'project_member', action: 'view' },
    loadContext: getActionContext,
    name: 'projects.listProjectMembers',
  },
  async (projectId): Promise<ProjectMember[]> => {
    const supabase = await createServerSupabase();
    return listProjectMembers(supabase, projectId);
  },
);
