import 'server-only';
import { rupiahFromColumn, rupiahToColumn } from '@/core/money/rupiah';
import type { ServerSupabase } from '@/core/db/client.server';
import { NotFoundError } from '@/core/errors/app-error';
import type { Contract, ContractUpdate, NewContract } from '../types';
import type { Tables } from '@/core/db/database.types';

/**
 * All direct `contracts` table access lives here (ARCHITECTURE.md 1.2).
 *
 * `contract_amount` crosses the wire as `number` (ADR 0008) -- every read
 * converts it to `Rupiah` via `rupiahFromColumn` before returning, and every
 * write converts back via `rupiahToColumn` immediately before the call.
 * Nothing outside this file ever sees the raw column value.
 */

function toContract(row: Tables<'contracts'>): Contract {
  return { ...row, contract_amount: rupiahFromColumn(row.contract_amount) };
}

export async function listContractsForProject(supabase: ServerSupabase, projectId: string): Promise<Contract[]> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('created_at');

  if (error !== null) throw error;
  return data.map(toContract);
}

export async function getContract(supabase: ServerSupabase, id: string): Promise<Contract> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Contract ${id} not found`, { meta: { contractId: id } });
  }
  return toContract(data);
}

export async function insertContract(supabase: ServerSupabase, input: NewContract): Promise<Contract> {
  const { data, error } = await supabase
    .from('contracts')
    .insert({ ...input, contract_amount: rupiahToColumn(input.contract_amount) })
    .select()
    .single();

  if (error !== null) throw error;
  return toContract(data);
}

export async function updateContract(supabase: ServerSupabase, id: string, patch: ContractUpdate): Promise<Contract> {
  const { contract_amount, ...rest } = patch;

  const { data, error } = await supabase
    .from('contracts')
    .update({
      ...rest,
      ...(contract_amount !== undefined ? { contract_amount: rupiahToColumn(contract_amount) } : {}),
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Contract ${id} not found`, { meta: { contractId: id } });
  }
  return toContract(data);
}
