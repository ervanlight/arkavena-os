import 'server-only';
import { rupiahFromColumn, rupiahToColumn, type Rupiah } from '@/core/money/rupiah';
import type { ServerSupabase } from '@/core/db/client.server';
import { NotFoundError } from '@/core/errors/app-error';
import type { Lead, LeadUpdate, NewLead } from '../types';

/** All direct `leads` table access lives here (ARCHITECTURE.md 1.2). */

function toLead(row: Omit<Lead, 'estimated_value'> & { estimated_value: number | null }): Lead {
  return { ...row, estimated_value: row.estimated_value === null ? null : rupiahFromColumn(row.estimated_value) };
}

export async function listLeads(supabase: ServerSupabase): Promise<Lead[]> {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error !== null) throw error;
  return data.map(toLead);
}

export async function getLead(supabase: ServerSupabase, id: string): Promise<Lead> {
  const { data, error } = await supabase.from('leads').select('*').eq('id', id).is('deleted_at', null).maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Lead ${id} not found`, { meta: { leadId: id } });
  }
  return toLead(data);
}

function estimatedValueColumn(value: Rupiah | null | undefined): { estimated_value?: number | null } {
  if (value === undefined) return {};
  return { estimated_value: value === null ? null : rupiahToColumn(value) };
}

export async function insertLead(supabase: ServerSupabase, input: NewLead): Promise<Lead> {
  const { estimated_value, ...rest } = input;
  const { data, error } = await supabase
    .from('leads')
    .insert({ ...rest, ...estimatedValueColumn(estimated_value) })
    .select()
    .single();

  if (error !== null) throw error;
  return toLead(data);
}

export async function updateLead(supabase: ServerSupabase, id: string, patch: LeadUpdate): Promise<Lead> {
  const { estimated_value, ...rest } = patch;
  const { data, error } = await supabase
    .from('leads')
    .update({ ...rest, ...estimatedValueColumn(estimated_value) })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Lead ${id} not found`, { meta: { leadId: id } });
  }
  return toLead(data);
}
