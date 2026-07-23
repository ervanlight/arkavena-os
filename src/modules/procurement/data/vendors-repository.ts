import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import { NotFoundError } from '@/core/errors/app-error';
import type { NewVendor, Vendor, VendorUpdate } from '../types';

/** All direct `vendors` table access lives here (ARCHITECTURE.md 1.2). */

export async function listVendors(supabase: ServerSupabase): Promise<Vendor[]> {
  const { data, error } = await supabase.from('vendors').select('*').is('deleted_at', null).order('name', { ascending: true });

  if (error !== null) throw error;
  return data;
}

export async function getVendor(supabase: ServerSupabase, id: string): Promise<Vendor> {
  const { data, error } = await supabase.from('vendors').select('*').eq('id', id).is('deleted_at', null).maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Vendor ${id} not found`, { meta: { vendorId: id } });
  }
  return data;
}

export async function insertVendor(supabase: ServerSupabase, input: NewVendor): Promise<Vendor> {
  const { data, error } = await supabase.from('vendors').insert(input).select().single();

  if (error !== null) throw error;
  return data;
}

export async function updateVendor(supabase: ServerSupabase, id: string, patch: VendorUpdate): Promise<Vendor> {
  const { data, error } = await supabase
    .from('vendors')
    .update(patch)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Vendor ${id} not found`, { meta: { vendorId: id } });
  }
  return data;
}
