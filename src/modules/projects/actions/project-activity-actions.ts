'use server';

import { z } from 'zod';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { listProjectActivity } from '@/core/audit/read.server';
import type { ProjectActivityRow } from '@/core/audit/read.server';

/**
 * The project's activity journal (audit_logs, staff-only). Owned by
 * modules/projects because it is a project-of-record read; the underlying
 * `audit_logs` table belongs to core/audit, so this calls its read helper
 * rather than querying that table directly (ARCHITECTURE.md 1.2). Gated by
 * the same `project.view` permission as the rest of the project surface;
 * `audit_logs_select_staff` RLS is the real row-level gate underneath.
 */
export const listProjectActivityAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'project', action: 'view' },
    loadContext: getActionContext,
    name: 'projects.listProjectActivity',
  },
  async (projectId): Promise<ProjectActivityRow[]> => {
    const supabase = await createServerSupabase();
    return listProjectActivity(supabase, projectId);
  },
);
