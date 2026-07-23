import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import { NotFoundError } from '@/core/errors/app-error';
import type { NewProposal, Proposal, ProposalUpdate } from '../types';

/** All direct `proposals` table access lives here (ARCHITECTURE.md 1.2). */

export async function listProposalsForProject(supabase: ServerSupabase, projectId: string): Promise<Proposal[]> {
  const { data, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error !== null) throw error;
  return data;
}

export async function getProposal(supabase: ServerSupabase, id: string): Promise<Proposal> {
  const { data, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Proposal ${id} not found`, { meta: { proposalId: id } });
  }
  return data;
}

export async function insertProposal(supabase: ServerSupabase, input: NewProposal): Promise<Proposal> {
  const { data, error } = await supabase.from('proposals').insert(input).select().single();

  if (error !== null) throw error;
  return data;
}

export async function updateProposal(supabase: ServerSupabase, id: string, patch: ProposalUpdate): Promise<Proposal> {
  const { data, error } = await supabase
    .from('proposals')
    .update(patch)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Proposal ${id} not found`, { meta: { proposalId: id } });
  }
  return data;
}
