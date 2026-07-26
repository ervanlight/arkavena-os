'use server';

import { z } from 'zod';
import { safeAction } from '@/core/actions/safe-action';
import { getActionContext } from '@/core/auth/session';
import { createServerSupabase } from '@/core/db/client.server';
import { inviteProjectMemberAction } from '@/modules/projects';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExternalUserWithProjects = {
  userId: string;
  fullName: string;
  email: string;
  status: string;
  projects: { projectId: string; projectName: string; role: string; memberId: string }[];
};

// ─── List Subkon Users ─────────────────────────────────────────────────────────

export const listSubkonUsersAction = safeAction(
  {
    name: 'access.listSubkonUsers',
    schema: z.void(),
    permission: { resource: 'project_member', action: 'view' },
    loadContext: getActionContext,
  },
  async (_input, ctx): Promise<ExternalUserWithProjects[]> => {
    const supabase = await createServerSupabase();

    // Get all project_members with subcontractor/photo_uploader roles in org projects
    const { data, error } = await supabase
      .from('project_members')
      .select(`
        id,
        project_role,
        user_id,
        projects!inner ( id, name, organization_id ),
        users!inner ( id, full_name, email, status )
      `)
      .in('project_role', ['subcontractor', 'photo_uploader'])
      .eq('projects.organization_id', ctx.organizationId)
      .is('deleted_at', null);

    if (error !== null) throw error;

    // Group by user
    const userMap = new Map<string, ExternalUserWithProjects>();
    for (const row of data ?? []) {
      const user = row.users as unknown as { id: string; full_name: string; email: string; status: string };
      const project = row.projects as unknown as { id: string; name: string };

      if (!userMap.has(user.id)) {
        userMap.set(user.id, {
          userId: user.id,
          fullName: user.full_name,
          email: user.email,
          status: user.status,
          projects: [],
        });
      }
      userMap.get(user.id)!.projects.push({
        projectId: project.id,
        projectName: project.name,
        role: row.project_role,
        memberId: row.id,
      });
    }

    return Array.from(userMap.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));
  },
);

// ─── List Client Portal Users ─────────────────────────────────────────────────

export const listClientPortalUsersAction = safeAction(
  {
    name: 'access.listClientPortalUsers',
    schema: z.void(),
    permission: { resource: 'project_member', action: 'view' },
    loadContext: getActionContext,
  },
  async (_input, ctx): Promise<ExternalUserWithProjects[]> => {
    const supabase = await createServerSupabase();

    const { data, error } = await supabase
      .from('project_members')
      .select(`
        id,
        project_role,
        user_id,
        projects!inner ( id, name, organization_id ),
        users!inner ( id, full_name, email, status )
      `)
      .in('project_role', ['client_approver', 'client_viewer'])
      .eq('projects.organization_id', ctx.organizationId)
      .is('deleted_at', null);

    if (error !== null) throw error;

    const userMap = new Map<string, ExternalUserWithProjects>();
    for (const row of data ?? []) {
      const user = row.users as unknown as { id: string; full_name: string; email: string; status: string };
      const project = row.projects as unknown as { id: string; name: string };

      if (!userMap.has(user.id)) {
        userMap.set(user.id, {
          userId: user.id,
          fullName: user.full_name,
          email: user.email,
          status: user.status,
          projects: [],
        });
      }
      userMap.get(user.id)!.projects.push({
        projectId: project.id,
        projectName: project.name,
        role: row.project_role,
        memberId: row.id,
      });
    }

    return Array.from(userMap.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));
  },
);

// ─── List Projects (for invite form dropdown) ─────────────────────────────────

export const listProjectsForAccessAction = safeAction(
  {
    name: 'access.listProjectsForAccess',
    schema: z.void(),
    permission: { resource: 'project', action: 'view' },
    loadContext: getActionContext,
  },
  async (_input, ctx): Promise<{ id: string; name: string }[]> => {
    const supabase = await createServerSupabase();

    const { data, error } = await supabase
      .from('projects')
      .select('id, name')
      .eq('organization_id', ctx.organizationId)
      .is('deleted_at', null)
      .order('name');

    if (error !== null) throw error;
    return data ?? [];
  },
);

// ─── Revoke Project Member ─────────────────────────────────────────────────────

export const revokeProjectAccessAction = safeAction(
  {
    name: 'access.revokeProjectAccess',
    schema: z.object({ memberId: z.string().uuid() }),
    permission: { resource: 'project_member', action: 'remove' },
    loadContext: getActionContext,
  },
  async ({ memberId }, _ctx): Promise<null> => {
    const supabase = await createServerSupabase();
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('id', memberId);
    if (error !== null) throw error;
    return null;
  },
);

export { inviteProjectMemberAction };
