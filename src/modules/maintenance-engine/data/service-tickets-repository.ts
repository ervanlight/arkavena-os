import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import { NotFoundError } from '@/core/errors/app-error';
import type { NewServiceTicket, ServiceTicket, ServiceTicketUpdate } from '../types';

/** All direct `service_tickets` table access lives here (ARCHITECTURE.md 1.2). */

export async function listServiceTicketsForAsset(
  supabase: ServerSupabase,
  assetId: string,
): Promise<ServiceTicket[]> {
  const { data, error } = await supabase
    .from('service_tickets')
    .select('*')
    .eq('asset_id', assetId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error !== null) throw error;
  return data;
}

/** Phase 3 (F4): the Client Timeline's own read -- a client sees their own reported/tracked tickets. service_tickets_select_client RLS is the real gate. */
export async function listServiceTicketsForClient(supabase: ServerSupabase, clientId: string): Promise<ServiceTicket[]> {
  const { data, error } = await supabase
    .from('service_tickets')
    .select('*')
    .eq('client_id', clientId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error !== null) throw error;
  return data;
}

export async function getServiceTicket(supabase: ServerSupabase, id: string): Promise<ServiceTicket> {
  const { data, error } = await supabase
    .from('service_tickets')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Service ticket ${id} not found`, { meta: { serviceTicketId: id } });
  }
  return data;
}

export async function insertServiceTicket(
  supabase: ServerSupabase,
  input: NewServiceTicket,
): Promise<ServiceTicket> {
  const { data, error } = await supabase.from('service_tickets').insert(input).select().single();

  if (error !== null) throw error;
  return data;
}

export async function updateServiceTicket(
  supabase: ServerSupabase,
  id: string,
  patch: ServiceTicketUpdate,
): Promise<ServiceTicket> {
  const { data, error } = await supabase
    .from('service_tickets')
    .update(patch)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Service ticket ${id} not found`, { meta: { serviceTicketId: id } });
  }
  return data;
}
