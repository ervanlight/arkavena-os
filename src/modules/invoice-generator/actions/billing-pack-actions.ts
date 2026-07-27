'use server';

import { z } from 'zod';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { getChangeOrderAction, type ChangeOrder } from '@/modules/variations';
import { listWorkPackagesForProjectAction } from '@/modules/projects';
import { listPhotosForProjectAction, type Photo } from '@/modules/daily-report-inbox';
import { getInvoice } from '../data/invoices-repository';
import type { Invoice } from '../types';

export type BillingPackHoldPoint = { templateName: string; status: string; overridden: boolean };

export type BillingPack = {
  invoice: Invoice;
  evidencePhotos: Photo[];
  qcStatus: BillingPackHoldPoint[];
  variation: ChangeOrder | null;
};

/**
 * ARCHITECTURE.md 7's "billing pack (invoice + evidence + QC + variation
 * summary)", assembled at request time from each owning module's public
 * API (ADR 0017 SS4) -- no billing_packs table, so this can never show
 * stale data relative to the modules it summarizes.
 */
export const getBillingPackAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'invoice', action: 'view' },
    loadContext: getActionContext,
    name: 'billing.getBillingPack',
  },
  async (invoiceId): Promise<BillingPack> => {
    const supabase = await createServerSupabase();
    const invoice = await getInvoice(supabase, invoiceId);

    const [workPackagesResult, photosResult, changeOrderResult] = await Promise.all([
      listWorkPackagesForProjectAction(invoice.project_id),
      listPhotosForProjectAction(invoice.project_id),
      invoice.change_order_id !== null ? getChangeOrderAction(invoice.change_order_id) : Promise.resolve(null),
    ]);

    const milestoneWorkPackages = workPackagesResult.ok
      ? workPackagesResult.data.filter((wp) => wp.milestone_id === invoice.milestone_id)
      : [];
    const workPackageIds = new Set(milestoneWorkPackages.map((wp) => wp.id));

    const evidencePhotos = (photosResult.ok ? photosResult.data : []).filter(
      (photo) => photo.work_package_id !== null && workPackageIds.has(photo.work_package_id),
    );

    const { data: inspectionsData } = await supabase
      .from('inspections')
      .select('status, overridden_at, hold_point_templates(name)')
      .eq('project_id', invoice.project_id)
      .is('deleted_at', null);

    const qcStatus: BillingPackHoldPoint[] = (inspectionsData ?? []).map((insp: any) => ({
      templateName: insp.hold_point_templates?.name ?? 'QC Inspection',
      status: insp.status,
      overridden: insp.overridden_at !== null,
    }));

    const variation = changeOrderResult !== null && changeOrderResult.ok ? changeOrderResult.data : null;

    return { invoice, evidencePhotos, qcStatus, variation };
  },
);
