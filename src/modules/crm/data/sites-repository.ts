import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import { InfraError, NotFoundError } from '@/core/errors/app-error';
import type { NewSite, Site, SiteUpdate } from '../types';

/** All direct `sites` table access lives here (ARCHITECTURE.md 1.2). */

export async function listSitesForClient(supabase: ServerSupabase, clientId: string): Promise<Site[]> {
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .eq('client_id', clientId)
    .is('deleted_at', null)
    .order('name');

  if (error !== null) {
    throw new InfraError(`Failed to list sites for client ${clientId}: ${error.message}`);
  }
  return data;
}

export async function listSites(supabase: ServerSupabase): Promise<Site[]> {
  const { data, error } = await supabase.from('sites').select('*').is('deleted_at', null).order('name');

  if (error !== null) {
    throw new InfraError(`Failed to list sites: ${error.message}`);
  }
  return data;
}

export async function getSite(supabase: ServerSupabase, id: string): Promise<Site> {
  const { data, error } = await supabase.from('sites').select('*').eq('id', id).is('deleted_at', null).maybeSingle();

  if (error !== null) {
    throw new InfraError(`Failed to load site ${id}: ${error.message}`);
  }
  if (data === null) {
    throw new NotFoundError(`Site ${id} not found`, { meta: { siteId: id } });
  }
  return data;
}

export async function insertSite(supabase: ServerSupabase, input: NewSite): Promise<Site> {
  const { data, error } = await supabase.from('sites').insert(input).select().single();

  if (error !== null) {
    throw new InfraError(`Failed to create site: ${error.message}`);
  }
  return data;
}

export async function updateSite(supabase: ServerSupabase, id: string, patch: SiteUpdate): Promise<Site> {
  const { data, error } = await supabase
    .from('sites')
    .update(patch)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();

  if (error !== null) {
    throw new InfraError(`Failed to update site ${id}: ${error.message}`);
  }
  if (data === null) {
    throw new NotFoundError(`Site ${id} not found`, { meta: { siteId: id } });
  }
  return data;
}
