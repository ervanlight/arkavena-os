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
  listMyClientProjects,
  listMyFieldProjects,
  listMyPartnerProjects,
  listProjectMembers,
  listMyProjectRoles,
} from '../data/project-members-repository';
import { provisionExternalUser } from '@/core/auth/provision-external-user';
import { addProjectMemberSchema, inviteProjectMemberSchema, removeProjectMemberSchema } from '../schemas';
import type { ProjectMember } from '../types';
import type { Enums } from '@/core/db/database.types';

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

/**
 * Onboards someone who has no account yet: provisions the auth/users rows
 * (core/auth/provision-external-user), then assigns them the project role.
 * Written because addProjectMemberAction alone requires a `userId` that must
 * already exist, and until now nothing in the UI ever created one for a
 * client or field worker -- inviteVendorUserAction (modules/procurement) was
 * the only flow that had ever called provisionExternalUser, so suppliers
 * could be onboarded through the app while client_approver/client_viewer and
 * site_coordinator/mandor could not be onboarded at all.
 *
 * Returns the temporary password so the inviter can pass it on out-of-band;
 * it is null when the email already had an account, since re-inviting must
 * never silently reset someone's existing password.
 */
export const inviteProjectMemberAction = safeAction(
  {
    schema: inviteProjectMemberSchema,
    permission: { resource: 'project_member', action: 'add' },
    loadContext: getActionContext,
    name: 'projects.inviteProjectMember',
  },
  async (input, ctx): Promise<ProjectMember & { temporaryPassword: string | null }> => {
    const { userId, temporaryPassword } = await provisionExternalUser({
      organizationId: ctx.organizationId,
      email: input.email,
      fullName: input.fullName,
    });

    const supabase = await createServerSupabase();
    const member = await insertProjectMember(supabase, {
      project_id: input.projectId,
      user_id: userId,
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

    return { ...member, temporaryPassword };
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

/**
 * No `permission` entry: this is the "available to any signed-in user" case
 * safeAction's own doc comment calls out. It only ever returns the caller's
 * own membership rows (RLS's project_members_select_self), so there is no
 * resource to gate -- used by auth/callback to decide where a bare magic
 * link (no explicit `next`) should land for a project-role-only user.
 */
export const getMyProjectRolesAction = safeAction(
  {
    schema: z.void(),
    loadContext: getActionContext,
    name: 'projects.getMyProjectRoles',
  },
  async (_input, ctx): Promise<Enums<'project_role'>[]> => {
    const supabase = await createServerSupabase();
    return listMyProjectRoles(supabase, ctx.userId);
  },
);

/** Same "available to any signed-in user" case as getMyProjectRolesAction -- SiteFlow's home page uses this to decide whether a project picker is needed at all. */
export const listMyFieldProjectsAction = safeAction(
  {
    schema: z.void(),
    loadContext: getActionContext,
    name: 'projects.listMyFieldProjects',
  },
  async (_input, ctx): Promise<{ id: string; name: string }[]> => {
    const supabase = await createServerSupabase();
    return listMyFieldProjects(supabase, ctx.userId);
  },
);

/** Same "available to any signed-in user" case as listMyFieldProjectsAction -- the client portal's project picker/nav uses this. */
export const listMyClientProjectsAction = safeAction(
  {
    schema: z.void(),
    loadContext: getActionContext,
    name: 'projects.listMyClientProjects',
  },
  async (_input, ctx): Promise<{ id: string; name: string }[]> => {
    const supabase = await createServerSupabase();
    return listMyClientProjects(supabase, ctx.userId);
  },
);

/** Same "available to any signed-in user" case as listMyClientProjectsAction -- Partner Desk's project picker uses this. */
export const listMyPartnerProjectsAction = safeAction(
  {
    schema: z.void(),
    loadContext: getActionContext,
    name: 'projects.listMyPartnerProjects',
  },
  async (_input, ctx): Promise<{ id: string; name: string }[]> => {
    const supabase = await createServerSupabase();
    return listMyPartnerProjects(supabase, ctx.userId);
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
