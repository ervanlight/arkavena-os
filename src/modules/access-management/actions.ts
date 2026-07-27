'use server';

import { z } from 'zod';
import { safeAction } from '@/core/actions/safe-action';
import { getActionContext } from '@/core/auth/session';
import { createServerSupabase } from '@/core/db/client.server';
import { inviteProjectMemberAction } from '@/modules/projects';
import { adminResetUserPassword, adminDeleteUserAccount } from '@/core/auth/provision-external-user';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExternalUserWithProjects = {
  userId: string;
  fullName: string;
  email: string;
  status: string;
  managedPassword?: string | null | undefined;
  projects: { projectId: string; projectName: string; role: string; memberId: string }[];
};

// ─── High Performance Batch Data Fetcher for Page Rendering ───────────────────

export async function getAkunPageData(): Promise<{
  allUsers: ExternalUserWithProjects[];
  projects: { id: string; name: string }[];
}> {
  const supabase = await createServerSupabase();

  const [membersRes, projectsRes] = await Promise.all([
    supabase
      .from('project_members')
      .select(`
        id,
        project_role,
        user_id,
        projects!inner ( id, name, organization_id ),
        users!inner ( id, full_name, email, status, managed_password )
      `)
      .in('project_role', ['subcontractor', 'photo_uploader', 'client_approver', 'client_viewer'])
      .is('deleted_at', null),
    supabase
      .from('projects')
      .select('id, name')
      .is('deleted_at', null)
      .order('name'),
  ]);

  if (membersRes.error !== null) throw membersRes.error;
  if (projectsRes.error !== null) throw projectsRes.error;

  const userMap = new Map<string, ExternalUserWithProjects>();
  for (const row of membersRes.data ?? []) {
    const user = row.users as unknown as { id: string; full_name: string; email: string; status: string; managed_password?: string | null };
    const project = row.projects as unknown as { id: string; name: string };

    if (!userMap.has(user.id)) {
      userMap.set(user.id, {
        userId: user.id,
        fullName: user.full_name,
        email: user.email,
        status: user.status,
        managedPassword: user.managed_password ?? null,
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

  const allUsers = Array.from(userMap.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));
  const projects = projectsRes.data ?? [];

  return { allUsers, projects };
}

// ─── List Subkon Users ─────────────────────────────────────────────────────────

export const listSubkonUsersAction = safeAction(
  {
    name: 'access.listSubkonUsers',
    schema: z.void(),
    permission: { resource: 'project_member', action: 'view' },
    loadContext: getActionContext,
  },
  async (_input, _ctx): Promise<ExternalUserWithProjects[]> => {
    const { allUsers } = await getAkunPageData();
    return allUsers.filter((u) => u.projects.some((p) => p.role === 'subcontractor' || p.role === 'photo_uploader'));
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
  async (_input, _ctx): Promise<ExternalUserWithProjects[]> => {
    const { allUsers } = await getAkunPageData();
    return allUsers.filter((u) => u.projects.some((p) => p.role === 'client_approver' || p.role === 'client_viewer'));
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
  async (_input, _ctx): Promise<{ id: string; name: string }[]> => {
    const { projects } = await getAkunPageData();
    return projects;
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

// ─── Reset Password ────────────────────────────────────────────────────────────

export const resetUserPasswordAction = safeAction(
  {
    name: 'access.resetUserPassword',
    schema: z.object({
      userId: z.string().uuid(),
      newPassword: z.string().trim().min(4, 'Password minimal 4 karakter'),
    }),
    permission: { resource: 'project_member', action: 'update' },
    loadContext: getActionContext,
  },
  async ({ userId, newPassword }, _ctx): Promise<null> => {
    await adminResetUserPassword(userId, newPassword);
    return null;
  },
);

// ─── Delete Entire User Account ────────────────────────────────────────────────

export const deleteUserAccountAction = safeAction(
  {
    name: 'access.deleteUserAccount',
    schema: z.object({ userId: z.string().uuid() }),
    permission: { resource: 'project_member', action: 'remove' },
    loadContext: getActionContext,
  },
  async ({ userId }, _ctx): Promise<null> => {
    await adminDeleteUserAccount(userId);
    return null;
  },
);

export { inviteProjectMemberAction };
