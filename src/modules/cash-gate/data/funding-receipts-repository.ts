import 'server-only';
import { rupiahFromColumn, rupiahToColumn } from '@/core/money/rupiah';
import type { ServerSupabase } from '@/core/db/client.server';
import { InfraError, NotFoundError } from '@/core/errors/app-error';
import type { Tables } from '@/core/db/database.types';
import type { FundingReceipt, NewFundingReceipt } from '../types';

/**
 * All direct `funding_receipts` table access lives here (ARCHITECTURE.md
 * 1.2). `amount` crosses the wire as `number` (ADR 0008) -- converted to
 * `Rupiah` on every read, converted back on every write, matching
 * modules/projects/data/contracts-repository.ts's convention exactly.
 */

function toFundingReceipt(row: Tables<'funding_receipts'>): FundingReceipt {
  return { ...row, amount: rupiahFromColumn(row.amount) };
}

export async function listFundingReceiptsForProject(
  supabase: ServerSupabase,
  projectId: string,
): Promise<FundingReceipt[]> {
  const { data, error } = await supabase
    .from('funding_receipts')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('expected_date', { ascending: false });

  if (error !== null) {
    throw new InfraError(`Failed to list funding receipts for project ${projectId}: ${error.message}`);
  }
  return data.map(toFundingReceipt);
}

export async function getFundingReceipt(supabase: ServerSupabase, id: string): Promise<FundingReceipt> {
  const { data, error } = await supabase
    .from('funding_receipts')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error !== null) {
    throw new InfraError(`Failed to load funding receipt ${id}: ${error.message}`);
  }
  if (data === null) {
    throw new NotFoundError(`Funding receipt ${id} not found`, { meta: { fundingReceiptId: id } });
  }
  return toFundingReceipt(data);
}

export async function insertFundingReceipt(
  supabase: ServerSupabase,
  input: NewFundingReceipt,
): Promise<FundingReceipt> {
  const { data, error } = await supabase
    .from('funding_receipts')
    .insert({ ...input, amount: rupiahToColumn(input.amount) })
    .select()
    .single();

  if (error !== null) {
    throw new InfraError(`Failed to record funding receipt: ${error.message}`);
  }
  return toFundingReceipt(data);
}

/** Finance marking a receipt as cleared -- the moment owner decision D5's manual cash confirmation happens. */
export async function markFundingReceiptCleared(
  supabase: ServerSupabase,
  id: string,
  proofPath: string | null,
): Promise<FundingReceipt> {
  const { data, error } = await supabase
    .from('funding_receipts')
    .update({ cleared_at: new Date().toISOString(), proof_path: proofPath })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();

  if (error !== null) {
    throw new InfraError(`Failed to mark funding receipt ${id} cleared: ${error.message}`);
  }
  if (data === null) {
    throw new NotFoundError(`Funding receipt ${id} not found`, { meta: { fundingReceiptId: id } });
  }
  return toFundingReceipt(data);
}
