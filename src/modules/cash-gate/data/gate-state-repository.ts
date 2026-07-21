import 'server-only';
import { rupiahFromColumn, sumRp, toRupiah } from '@/core/money/rupiah';
import type { ServerSupabase } from '@/core/db/client.server';
import { InfraError } from '@/core/errors/app-error';
import { getProjectRiskReserve } from './project-risk-reserves-repository';
import { computeFundingCoverage, determineGateStatus, OVERDUE_GRACE_DAYS } from '../domain/funding-coverage';
import type { GateState } from '../domain/types';

/**
 * Aggregates the raw numbers fn_cash_gate_status also aggregates in SQL, and
 * feeds them to the same pure domain functions the database trigger's SQL
 * mirrors -- ARCHITECTURE.md 0.2's two independent layers, kept in sync by
 * shared design and tests, not by one calling the other (this repository
 * never calls fn_cash_gate_status; the trigger is the only caller of that).
 *
 * ADR 0009 decision 2: committedCosts is this placeholder until Fase 8's
 * procurement module gives it a real source.
 */
const COMMITTED_COSTS_PLACEHOLDER = toRupiah(0);

/**
 * UTC calendar date, `offsetDays` from today, as `YYYY-MM-DD`. Matches
 * Postgres's `current_date` under the assumption the database session runs in
 * UTC (Supabase's default) -- if that ever changes, this and
 * fn_cash_gate_status's `current_date` need to move together.
 */
function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export async function loadGateState(supabase: ServerSupabase, projectId: string): Promise<GateState> {
  const [clearedResult, forecastResult, riskReserve, overdueResult] = await Promise.all([
    supabase
      .from('funding_receipts')
      .select('amount')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .not('cleared_at', 'is', null),
    supabase
      .from('cash_forecasts')
      .select('needed_amount')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .gte('needed_by_date', isoDate(0))
      .lte('needed_by_date', isoDate(14)),
    // project_risk_reserves is owned by this module outright (ADR 0011) --
    // no cross-module call needed anymore.
    getProjectRiskReserve(supabase, projectId),
    supabase
      .from('funding_receipts')
      .select('id')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .is('cleared_at', null)
      .lt('expected_date', isoDate(-OVERDUE_GRACE_DAYS))
      .limit(1),
  ]);

  if (clearedResult.error !== null) {
    throw new InfraError(`Failed to load cleared funds for project ${projectId}: ${clearedResult.error.message}`);
  }
  if (forecastResult.error !== null) {
    throw new InfraError(`Failed to load cash forecasts for project ${projectId}: ${forecastResult.error.message}`);
  }
  if (overdueResult.error !== null) {
    throw new InfraError(`Failed to check overdue receipts for project ${projectId}: ${overdueResult.error.message}`);
  }

  const clearedFunds = sumRp(clearedResult.data.map((row) => rupiahFromColumn(row.amount)));
  const next14DayNeeds = sumRp(forecastResult.data.map((row) => rupiahFromColumn(row.needed_amount)));
  const isOverdue = overdueResult.data.length > 0;

  const coverage = computeFundingCoverage({
    clearedFunds,
    committedCosts: COMMITTED_COSTS_PLACEHOLDER,
    next14DayNeeds,
    riskReserve,
  });

  return determineGateStatus({ coverage, isOverdue });
}
