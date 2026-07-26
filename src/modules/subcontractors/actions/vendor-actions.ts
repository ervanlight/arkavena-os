'use server';

import { z } from 'zod';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { listVendors, type Vendor } from '../data/vendors-repository';

export const listVendorsAction = safeAction(
  {
    schema: z.void(),
    permission: { resource: 'vendor', action: 'view' },
    loadContext: getActionContext,
    name: 'subcontractors.listVendors',
  },
  async (): Promise<Vendor[]> => {
    const supabase = await createServerSupabase();
    return listVendors(supabase);
  },
);
