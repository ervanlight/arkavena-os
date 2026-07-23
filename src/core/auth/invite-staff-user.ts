'use server';

import { z } from 'zod';
import { createAdminSupabase } from '@/core/db/admin.server';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { ConflictError } from '@/core/errors/app-error';
import { ORG_ROLES } from '@/core/permissions/matrix';
import { generateTemporaryPassword } from './generate-temporary-password';
import type { Tables } from '@/core/db/database.types';

/**
 * Owner creates a second real staff account (ADR 0025 SS2). matrix.ts
 * reserved `user.invite` (owner-only) from Fase 0; nothing implemented it
 * until now -- every org_role user to date was seeded or created by test
 * factories directly against the service-role client, never through a real
 * feature. Mirrors provision-external-user.ts's create-or-reuse-by-email
 * shape, but assigns an org_role instead of leaving it null.
 */
const inviteStaffUserSchema = z.object({
  email: z.string().trim().toLowerCase().email('Alamat email tidak valid'),
  fullName: z.string().trim().min(1, 'Nama wajib diisi'),
  orgRole: z.enum(ORG_ROLES),
});

/** Staff directory for the /cc/team page -- own org only, RLS backs this too but the query already scopes it explicitly like every other list action in this codebase. */
export const listStaffUsersAction = safeAction(
  {
    schema: z.void(),
    permission: { resource: 'user', action: 'view' },
    loadContext: getActionContext,
    name: 'auth.listStaffUsers',
  },
  async (_input, ctx): Promise<Tables<'users'>[]> => {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('organization_id', ctx.organizationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (error !== null) throw error;
    return data;
  },
);

export const inviteStaffUserAction = safeAction(
  {
    schema: inviteStaffUserSchema,
    permission: { resource: 'user', action: 'invite' },
    loadContext: getActionContext,
    name: 'auth.inviteStaffUser',
  },
  async (input, ctx): Promise<Tables<'users'> & { temporaryPassword: string | null }> => {
    const admin = createAdminSupabase();
    const email = input.email.trim().toLowerCase();

    const { data: existing, error: existingError } = await admin
      .from('users')
      .select('*')
      .ilike('email', email)
      .is('deleted_at', null)
      .maybeSingle();
    if (existingError !== null) throw existingError;

    if (existing !== null) {
      if (existing.organization_id !== ctx.organizationId) {
        throw new ConflictError(`Email ${email} is already registered under a different organization`, {
          userMessage: 'Alamat email ini sudah terdaftar untuk organisasi lain.',
          meta: { email },
        });
      }
      return { ...existing, temporaryPassword: null };
    }

    const temporaryPassword = generateTemporaryPassword();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
    });
    if (createError !== null) throw createError;

    const { data: inserted, error: insertError } = await admin
      .from('users')
      .insert({
        id: created.user.id,
        organization_id: ctx.organizationId,
        email,
        full_name: input.fullName,
        org_role: input.orgRole,
        status: 'active',
      })
      .select('*')
      .single();
    if (insertError !== null) throw insertError;

    const supabase = await createServerSupabase();
    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'users',
      entityId: inserted.id,
      action: 'insert',
      newValue: { email: inserted.email, org_role: inserted.org_role },
      requestId: ctx.requestId,
    });

    return { ...inserted, temporaryPassword };
  },
);
