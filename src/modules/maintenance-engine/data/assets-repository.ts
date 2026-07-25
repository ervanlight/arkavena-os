import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import { NotFoundError } from '@/core/errors/app-error';
import type { Asset, AssetUpdate, NewAsset } from '../types';

/** All direct `assets` table access lives here (ARCHITECTURE.md 1.2). */

export async function listAssets(supabase: ServerSupabase): Promise<Asset[]> {
  const { data, error } = await supabase.from('assets').select('*').is('deleted_at', null).order('name', { ascending: true });

  if (error !== null) throw error;
  return data;
}

export async function listAssetsForSite(supabase: ServerSupabase, siteId: string): Promise<Asset[]> {
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('site_id', siteId)
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (error !== null) throw error;
  return data;
}

/** Phase 3 (F4): the Client Timeline's own read -- lets a client see which assets on their project they can report a service ticket against. assets_select_client RLS is the real gate. */
export async function listAssetsForClient(supabase: ServerSupabase, clientId: string): Promise<Asset[]> {
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('client_id', clientId)
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (error !== null) throw error;
  return data;
}

export async function getAsset(supabase: ServerSupabase, id: string): Promise<Asset> {
  const { data, error } = await supabase.from('assets').select('*').eq('id', id).is('deleted_at', null).maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Asset ${id} not found`, { meta: { assetId: id } });
  }
  return data;
}

export async function insertAsset(supabase: ServerSupabase, input: NewAsset): Promise<Asset> {
  const { data, error } = await supabase.from('assets').insert(input).select().single();

  if (error !== null) throw error;
  return data;
}

export async function updateAsset(supabase: ServerSupabase, id: string, patch: AssetUpdate): Promise<Asset> {
  const { data, error } = await supabase
    .from('assets')
    .update(patch)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Asset ${id} not found`, { meta: { assetId: id } });
  }
  return data;
}
