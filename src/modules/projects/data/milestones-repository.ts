import 'server-only';
import { rupiahFromColumn, rupiahToColumn } from '@/core/money/rupiah';
import type { ServerSupabase } from '@/core/db/client.server';
import { NotFoundError } from '@/core/errors/app-error';
import type { Milestone, MilestoneUpdate, NewMilestone } from '../types';
import type { Tables } from '@/core/db/database.types';

/**
 * All direct `milestones` table access lives here (ARCHITECTURE.md 1.2).
 * `amount` crosses the wire as `number` (ADR 0008) -- same convert-at-the-edge
 * discipline as contracts-repository.ts.
 */

function toMilestone(row: Tables<'milestones'>): Milestone {
  return { ...row, amount: rupiahFromColumn(row.amount) };
}

export async function listMilestonesForContract(supabase: ServerSupabase, contractId: string): Promise<Milestone[]> {
  const { data, error } = await supabase
    .from('milestones')
    .select('*')
    .eq('contract_id', contractId)
    .is('deleted_at', null)
    .order('due_date', { nullsFirst: false });

  if (error !== null) throw error;
  return data.map(toMilestone);
}

export async function getMilestone(supabase: ServerSupabase, id: string): Promise<Milestone> {
  const { data, error } = await supabase
    .from('milestones')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Milestone ${id} not found`, { meta: { milestoneId: id } });
  }
  return toMilestone(data);
}

export async function insertMilestone(supabase: ServerSupabase, input: NewMilestone): Promise<Milestone> {
  const { data, error } = await supabase
    .from('milestones')
    .insert({ ...input, amount: rupiahToColumn(input.amount) })
    .select()
    .single();

  if (error !== null) throw error;
  return toMilestone(data);
}

export async function updateMilestone(
  supabase: ServerSupabase,
  id: string,
  patch: MilestoneUpdate,
): Promise<Milestone> {
  const { amount, ...rest } = patch;

  const { data, error } = await supabase
    .from('milestones')
    .update({
      ...rest,
      ...(amount !== undefined ? { amount: rupiahToColumn(amount) } : {}),
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Milestone ${id} not found`, { meta: { milestoneId: id } });
  }
  return toMilestone(data);
}
