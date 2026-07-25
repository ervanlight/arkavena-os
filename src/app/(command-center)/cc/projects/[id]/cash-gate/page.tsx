import { notFound } from 'next/navigation';
import { formatBp, formatRp, ZERO_RP } from '@/core/money/rupiah';
import { getCurrentUser } from '@/core/auth/session';
import { roleCan } from '@/core/permissions/matrix';
import {
  getGateStateAction,
  getRiskReserveAction,
  listCashForecastsForProjectAction,
  listFundingReceiptsForProjectAction,
  listOverridesForProjectAction,
} from '@/modules/cash-gate';
import { getProjectAction, listWorkPackagesForProjectAction } from '@/modules/projects';
import { Card, StatusBadge, EmptyState } from '@/core/ui';
import { FundingReceiptForm } from './funding-receipt-form';
import { MarkClearedForm } from './mark-cleared-form';
import { CashForecastForm } from './cash-forecast-form';
import { RiskReserveForm } from './risk-reserve-form';
import { OverrideForm } from './override-form';

export const metadata = { title: 'Cash Gate — BuildTrust OS' };

const STATUS_LABEL_ID: Record<string, string> = {
  green: 'Hijau',
  yellow: 'Kuning',
  red: 'Merah',
  overdue: 'Terlambat (Overdue)',
};

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  green: 'success',
  yellow: 'warning',
  red: 'danger',
  overdue: 'neutral',
};

export default async function CashGatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const [
    projectResult,
    gateResult,
    receiptsResult,
    forecastsResult,
    overridesResult,
    workPackagesResult,
    riskReserveResult,
    user,
  ] = await Promise.all([
    getProjectAction(projectId),
    getGateStateAction(projectId),
    listFundingReceiptsForProjectAction(projectId),
    listCashForecastsForProjectAction(projectId),
    listOverridesForProjectAction(projectId),
    listWorkPackagesForProjectAction(projectId),
    getRiskReserveAction(projectId),
    getCurrentUser(),
  ]);

  if (!projectResult.ok) {
    if (projectResult.error.code === 'NOT_FOUND') notFound();
    return (
      <p role="alert" className="text-sm text-[color:var(--color-danger)]">
        {projectResult.error.message}
      </p>
    );
  }

  const project = projectResult.data;
  const gate = gateResult.ok ? gateResult.data : null;
  const receipts = receiptsResult.ok ? receiptsResult.data : [];
  const forecasts = forecastsResult.ok ? forecastsResult.data : [];
  const overrides = overridesResult.ok ? overridesResult.data : [];
  const workPackages = workPackagesResult.ok ? workPackagesResult.data : [];
  const blockedWorkPackages = workPackages.filter((wp) => wp.status !== 'in_progress');
  const riskReserveAmount = riskReserveResult.ok ? riskReserveResult.data.toString() : '0';

  const isOwner = roleCan(user?.orgRole ?? null, 'cash_gate_override', 'create');
  const gateIsBlocking = gate !== null && (gate.status === 'red' || gate.status === 'overdue');

  return (
    <div className="space-y-8">
      <Card>
        {gate === null ? (
          <p role="alert" className="text-sm text-[color:var(--color-danger)]">
            {!gateResult.ok ? gateResult.error.message : 'Gagal memuat status Cash Gate.'}
          </p>
        ) : (
          <div className="flex items-center gap-4">
            <StatusBadge tone={STATUS_TONE[gate.status] ?? 'neutral'}>{STATUS_LABEL_ID[gate.status] ?? gate.status}</StatusBadge>
            <span className="text-sm text-[color:var(--color-ink-secondary)]">
              {gate.ratioBp === null ? 'Tidak ada kebutuhan kas terjadwal.' : `Rasio kecukupan: ${formatBp(gate.ratioBp)}`}
            </span>
          </div>
        )}
      </Card>

      {gateIsBlocking && (
        <Card className="border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger)]/5">
          <h2 className="text-[17px] font-semibold text-[color:var(--color-danger)]">Paket kerja tertahan</h2>
          <p className="mt-1 text-sm text-[color:var(--color-danger)]">
            Cash Gate {STATUS_LABEL_ID[gate!.status]?.toLowerCase()} -- paket kerja berikut tidak bisa dibuka sampai kas
            mencukupi, atau di-override oleh Owner dengan alasan.
          </p>
          {blockedWorkPackages.length > 0 && (
            <ul className="mt-3 list-inside list-disc text-sm text-[color:var(--color-danger)]">
              {blockedWorkPackages.map((wp) => (
                <li key={wp.id}>{wp.name}</li>
              ))}
            </ul>
          )}
          {isOwner && blockedWorkPackages.length > 0 && (
            <div className="mt-4 rounded-[var(--radius-control)] border border-dashed border-[color:var(--color-danger)]/40 bg-[color:var(--color-surface)] p-4">
              <OverrideForm workPackages={blockedWorkPackages} />
            </div>
          )}
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="space-y-4">
          <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Cadangan risiko (risk reserve)</h2>
          <p className="text-sm text-[color:var(--color-ink-secondary)]">
            Saat ini: {formatRp(riskReserveResult.ok ? riskReserveResult.data : ZERO_RP)}
          </p>
          <RiskReserveForm projectId={project.id} currentAmount={riskReserveAmount} />
        </Card>

        <Card className="space-y-4">
          <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Catat termin masuk</h2>
          <FundingReceiptForm projectId={project.id} />
        </Card>
      </div>

      <Card className="space-y-4">
        <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Termin (funding receipts)</h2>
        {receipts.length === 0 && <EmptyState title="Belum ada termin tercatat." />}
        {receipts.length > 0 && (
          <ul className="divide-y divide-[color:var(--color-hairline)]">
            {receipts.map((receipt) => (
              <li key={receipt.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-[color:var(--color-ink)]">{formatRp(receipt.amount)}</p>
                  <p className="text-xs text-[color:var(--color-ink-tertiary)]">Diharapkan: {receipt.expected_date}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm text-[color:var(--color-ink-secondary)]">
                    {receipt.cleared_at !== null ? 'Cair' : 'Menunggu'}
                  </span>
                  {receipt.cleared_at === null && <MarkClearedForm fundingReceiptId={receipt.id} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Proyeksi kebutuhan kas (cash forecasts)</h2>
        <CashForecastForm projectId={project.id} />
        {forecasts.length === 0 && <EmptyState title="Belum ada proyeksi kebutuhan kas." />}
        {forecasts.length > 0 && (
          <ul className="divide-y divide-[color:var(--color-hairline)]">
            {forecasts.map((forecast) => (
              <li key={forecast.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <p className="text-[15px] font-medium text-[color:var(--color-ink)]">{formatRp(forecast.needed_amount)}</p>
                <p className="text-sm text-[color:var(--color-ink-secondary)]">Dibutuhkan pada: {forecast.needed_by_date}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Riwayat override</h2>
        {overrides.length === 0 && <EmptyState title="Belum pernah ada override." />}
        {overrides.length > 0 && (
          <ul className="divide-y divide-[color:var(--color-hairline)]">
            {overrides.map((override) => (
              <li key={override.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-[color:var(--color-ink)]">{override.reason}</p>
                  <p className="text-xs text-[color:var(--color-ink-tertiary)]">{override.action}</p>
                </div>
                <p className="shrink-0 text-sm text-[color:var(--color-ink-secondary)]">
                  {new Date(override.created_at).toLocaleString('id-ID')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
