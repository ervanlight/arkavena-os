'use server';

import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { provisionExternalUser } from '@/core/auth/provision-external-user';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { addProjectMemberAction } from '@/modules/projects';
import { insertVendorUser } from '../data/vendor-users-repository';
import { inviteVendorUserSchema } from '../schemas';
import type { VendorUser } from '../types';

/**
 * Provisions a supplier's login (ADR 0024 SS6): creates the auth/users rows
 * if the email is new (core/auth/provision-external-user.ts), links them to
 * the vendor (vendor_users), and -- if a projectId is given -- adds them as
 * a `supplier` project_member through modules/projects' own public API
 * (ARCHITECTURE.md 1.2, never that module's repository directly), the same
 * cross-module call shape ai-scribe's actions already established.
 */
export const inviteVendorUserAction = safeAction(
  {
    schema: inviteVendorUserSchema,
    permission: { resource: 'vendor', action: 'invite' },
    loadContext: getActionContext,
    name: 'procurement.inviteVendorUser',
  },
  async (input, ctx): Promise<VendorUser & { temporaryPassword: string | null }> => {
    const { userId, temporaryPassword } = await provisionExternalUser({
      organizationId: ctx.organizationId,
      email: input.email,
      fullName: input.fullName,
    });

    const supabase = await createServerSupabase();
    const vendorUser = await insertVendorUser(supabase, { vendor_id: input.vendorId, user_id: userId });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'vendor_users',
      entityId: vendorUser.id,
      action: 'insert',
      newValue: vendorUser,
      requestId: ctx.requestId,
    });

    if (input.projectId !== undefined) {
      const memberResult = await addProjectMemberAction({
        projectId: input.projectId,
        userId,
        projectRole: 'supplier',
      });
      if (!memberResult.ok) {
        throw new Error(`Failed to add supplier as project member: ${memberResult.error.message}`);
      }
    }

    return { ...vendorUser, temporaryPassword };
  },
);
