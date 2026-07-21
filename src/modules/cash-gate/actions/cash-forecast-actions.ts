'use server';

import { z } from 'zod';
import { toRupiah } from '@/core/money/rupiah';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { insertCashForecast, listCashForecastsForProject } from '../data/cash-forecasts-repository';
import { createCashForecastSchema } from '../schemas';
import type { CashForecast } from '../types';

export const createCashForecastAction = safeAction(
  {
    schema: createCashForecastSchema,
    permission: { resource: 'cash_forecast', action: 'create' },
    loadContext: getActionContext,
    name: 'cashGate.createCashForecast',
  },
  async (input, ctx): Promise<CashForecast> => {
    const supabase = await createServerSupabase();
    const forecast = await insertCashForecast(supabase, {
      organization_id: ctx.organizationId,
      project_id: input.projectId,
      work_package_id: input.workPackageId ?? null,
      needed_amount: toRupiah(input.amount),
      needed_by_date: input.neededByDate,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'cash_forecasts',
      entityId: forecast.id,
      action: 'insert',
      newValue: { ...forecast, needed_amount: forecast.needed_amount.toString() },
      projectId: forecast.project_id,
      requestId: ctx.requestId,
    });

    return forecast;
  },
);

export const listCashForecastsForProjectAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'cash_forecast', action: 'view' },
    loadContext: getActionContext,
    name: 'cashGate.listCashForecastsForProject',
  },
  async (projectId): Promise<CashForecast[]> => {
    const supabase = await createServerSupabase();
    return listCashForecastsForProject(supabase, projectId);
  },
);
