import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import { NotFoundError } from '@/core/errors/app-error';
import type { Delivery, NewDelivery } from '../types';

/** All direct `deliveries` table access lives here (ARCHITECTURE.md 1.2). */

export async function listDeliveriesForPurchaseOrder(
  supabase: ServerSupabase,
  purchaseOrderId: string,
): Promise<Delivery[]> {
  const { data, error } = await supabase
    .from('deliveries')
    .select('*')
    .eq('purchase_order_id', purchaseOrderId)
    .is('deleted_at', null)
    .order('delivered_at', { ascending: false });

  if (error !== null) throw error;
  return data;
}

export async function getDelivery(supabase: ServerSupabase, id: string): Promise<Delivery> {
  const { data, error } = await supabase.from('deliveries').select('*').eq('id', id).is('deleted_at', null).maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Delivery ${id} not found`, { meta: { deliveryId: id } });
  }
  return data;
}

export async function insertDelivery(supabase: ServerSupabase, input: NewDelivery): Promise<Delivery> {
  const { data, error } = await supabase.from('deliveries').insert(input).select().single();

  if (error !== null) throw error;
  return data;
}
