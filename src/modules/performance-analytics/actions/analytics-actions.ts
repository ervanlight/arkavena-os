'use server';

import { z } from 'zod';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { listVendorPerformanceSummary } from '../data/vendor-performance-repository';
import type { VendorPerformanceSummary } from '../types';

export const listVendorPerformanceAction = safeAction(
  {
    schema: z.void(),
    // Performance analytics are an internal tool, accessible to staff (ARCHITECTURE.md).
    // Vendor is the closest resource mapping for evaluating vendors.
    permission: { resource: 'vendor', action: 'view' },
    loadContext: getActionContext,
    name: 'performanceAnalytics.listVendorPerformance',
  },
  async (_input, ctx): Promise<VendorPerformanceSummary[]> => {
    const supabase = await createServerSupabase();
    return listVendorPerformanceSummary(supabase, ctx.organizationId);
  },
);
