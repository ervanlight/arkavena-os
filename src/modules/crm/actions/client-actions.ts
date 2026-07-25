'use server';

import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { z } from 'zod';
import { createServerSupabase } from '@/core/db/client.server';
import { getClient, insertClient, listClients, updateClient, insertClientUser } from '../data/clients-repository';
import { createClientSchema, updateClientSchema } from '../schemas';
import type { Client } from '../types';
import { provisionExternalUser, type ProvisionedUser } from '@/core/auth/provision-external-user';

/**
 * A plain create/update has no reason, no override semantics -- nothing the
 * generic trigger channel (`trg_clients_audit`) does not already capture. It
 * still goes through `recordAudit` rather than being left to the trigger
 * alone, because that is the only channel carrying `request_id`
 * (ARCHITECTURE.md 5.1 rule 5: an incident traces from the UI toast to the
 * database row only if every mutation's audit entry carries it).
 */

export const createClientAction = safeAction(
  {
    schema: createClientSchema,
    permission: { resource: 'client', action: 'create' },
    loadContext: getActionContext,
    name: 'crm.createClient',
  },
  async (input, ctx): Promise<Client> => {
    const supabase = await createServerSupabase();
    const client = await insertClient(supabase, {
      organization_id: ctx.organizationId,
      name: input.name,
      contact_name: input.contactName ?? null,
      email: input.email === '' ? null : (input.email ?? null),
      phone: input.phone ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'clients',
      entityId: client.id,
      action: 'insert',
      newValue: client,
      requestId: ctx.requestId,
    });

    return client;
  },
);

export const updateClientAction = safeAction(
  {
    schema: updateClientSchema,
    permission: { resource: 'client', action: 'update' },
    loadContext: getActionContext,
    name: 'crm.updateClient',
  },
  async (input, ctx): Promise<Client> => {
    const supabase = await createServerSupabase();
    const before = await getClient(supabase, input.id);

    const after = await updateClient(supabase, input.id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.contactName !== undefined ? { contact_name: input.contactName } : {}),
      ...(input.email !== undefined ? { email: input.email === '' ? null : input.email } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'clients',
      entityId: after.id,
      action: 'update',
      previousValue: before,
      newValue: after,
      requestId: ctx.requestId,
    });

    return after;
  },
);

export const listClientsAction = safeAction(
  {
    schema: z.void(),
    permission: { resource: 'client', action: 'view' },
    loadContext: getActionContext,
    name: 'crm.listClients',
  },
  async (): Promise<Client[]> => {
    const supabase = await createServerSupabase();
    return listClients(supabase);
  },
);

export const provisionClientAccountAction = safeAction(
  {
    schema: z.object({ clientId: z.string().uuid() }),
    permission: { resource: 'client', action: 'update' },
    loadContext: getActionContext,
    name: 'crm.provisionClientAccount',
  },
  async (input, ctx): Promise<ProvisionedUser> => {
    const supabase = await createServerSupabase();
    const client = await getClient(supabase, input.clientId);
    
    if (!client.email) {
      throw new Error('Klien harus memiliki alamat email untuk dapat dibuatkan akun.');
    }

    const provisionResult = await provisionExternalUser({
      organizationId: ctx.organizationId,
      email: client.email,
      fullName: client.contact_name ?? client.name,
    });

    if (provisionResult.temporaryPassword !== null) {
      const { data: existingLink } = await supabase
        .from('client_users')
        .select('*')
        .eq('client_id', client.id)
        .eq('user_id', provisionResult.userId)
        .maybeSingle();

      if (!existingLink) {
        await insertClientUser(supabase, {
          client_id: client.id,
          user_id: provisionResult.userId,
        });
      }
    }

    return provisionResult;
  },
);
