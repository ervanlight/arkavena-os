import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import { InfraError, NotFoundError } from '@/core/errors/app-error';
import type { Client, ClientUpdate, NewClient } from '../types';

/**
 * All direct `clients` table access lives here -- ARCHITECTURE.md 1.2's
 * ownership rule: other modules read this data by calling modules/crm's
 * public API, never by querying `clients` themselves.
 *
 * RLS is the real scope here (ARCHITECTURE.md 0.2): every query below runs
 * through the caller's own session, so a query for another organisation's
 * clients returns nothing rather than needing an explicit filter to be safe.
 * `deleted_at is null` is filtered here regardless, because RLS does not do
 * that on its own -- the same convention core/auth/session.ts already
 * established for `users`.
 */

export async function listClients(supabase: ServerSupabase): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .is('deleted_at', null)
    .order('name');

  if (error !== null) {
    throw new InfraError(`Failed to list clients: ${error.message}`);
  }
  return data;
}

export async function getClient(supabase: ServerSupabase, id: string): Promise<Client> {
  const { data, error } = await supabase.from('clients').select('*').eq('id', id).is('deleted_at', null).maybeSingle();

  if (error !== null) {
    throw new InfraError(`Failed to load client ${id}: ${error.message}`);
  }
  if (data === null) {
    throw new NotFoundError(`Client ${id} not found`, { meta: { clientId: id } });
  }
  return data;
}

export async function insertClient(supabase: ServerSupabase, input: NewClient): Promise<Client> {
  const { data, error } = await supabase.from('clients').insert(input).select().single();

  if (error !== null) {
    throw new InfraError(`Failed to create client: ${error.message}`);
  }
  return data;
}

export async function updateClient(supabase: ServerSupabase, id: string, patch: ClientUpdate): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .update(patch)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();

  if (error !== null) {
    throw new InfraError(`Failed to update client ${id}: ${error.message}`);
  }
  if (data === null) {
    throw new NotFoundError(`Client ${id} not found`, { meta: { clientId: id } });
  }
  return data;
}
