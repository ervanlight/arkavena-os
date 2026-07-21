import { notFound } from 'next/navigation';
import Link from 'next/link';
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

const STATUS_BADGE_CLASS: Record<string, string> = {
  green: 'bg-emerald-100 text-emerald-800',
  yellow: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
  overdue: 'bg-slate-900 text-white',
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
      <p role="alert" className="text-sm text-red-600">
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
      <div>
        <Link href={`/cc/projects/${project.id}`} className="text-sm text-slate-500 hover:text-slate-900">
          ← {project.name}
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">Cash Gate</h1>
      </div>

      <div className="rounded-lg bg-white p-6 shadow-sm">
        {gate === null ? (
          <p role="alert" className="text-sm text-red-600">
            {!gateResult.ok ? gateResult.error.message : 'Gagal memuat status Cash Gate.'}
          </p>
        ) : (
          <div className="flex items-center gap-4">
            <span
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${STATUS_BADGE_CLASS[gate.status] ?? 'bg-slate-100 text-slate-800'}`}
            >
              {STATUS_LABEL_ID[gate.status] ?? gate.status}
            </span>
            <span className="text-sm text-slate-600">
              {gate.ratioBp === null ? 'Tidak ada kebutuhan kas terjadwal.' : `Rasio kecukupan: ${formatBp(gate.ratioBp)}`}
            </span>
          </div>
        )}
      </div>

      {gateIsBlocking && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <h2 className="text-sm font-semibold text-red-900">Paket kerja tertahan</h2>
          <p className="mt-1 text-sm text-red-800">
            Cash Gate {STATUS_LABEL_ID[gate!.status]?.toLowerCase()} -- paket kerja berikut tidak bisa dibuka sampai kas
            mencukupi, atau di-override oleh Owner dengan alasan.
          </p>
          {blockedWorkPackages.length > 0 && (
            <ul className="mt-3 list-inside list-disc text-sm text-red-900">
              {blockedWorkPackages.map((wp) => (
                <li key={wp.id}>{wp.name}</li>
              ))}
            </ul>
          )}
          {isOwner && blockedWorkPackages.length > 0 && (
            <div className="mt-4 rounded-md border border-dashed border-red-300 bg-white p-4">
              <OverrideForm workPackages={blockedWorkPackages} />
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Cadangan risiko (risk reserve)</h2>
          <p className="text-sm text-slate-600">
            Saat ini: {formatRp(riskReserveResult.ok ? riskReserveResult.data : ZERO_RP)}
          </p>
          <RiskReserveForm projectId={project.id} currentAmount={riskReserveAmount} />
        </section>

        <section className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Catat termin masuk</h2>
          <FundingReceiptForm projectId={project.id} />
        </section>
      </div>

      <section className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Termin (funding receipts)</h2>
        {receipts.length === 0 && <p className="text-sm text-slate-500">Belum ada termin tercatat.</p>}
        {receipts.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Nominal</th>
                  <th className="px-4 py-2 font-medium">Diharapkan</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receipts.map((receipt) => (
                  <tr key={receipt.id}>
                    <td className="px-4 py-2 font-medium text-slate-900">{formatRp(receipt.amount)}</td>
                    <td className="px-4 py-2 text-slate-600">{receipt.expected_date}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {receipt.cleared_at !== null ? 'Cair' : 'Menunggu'}
                    </td>
                    <td className="px-4 py-2">
                      {receipt.cleared_at === null && <MarkClearedForm fundingReceiptId={receipt.id} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Proyeksi kebutuhan kas (cash forecasts)</h2>
        <CashForecastForm projectId={project.id} />
        {forecasts.length === 0 && <p className="text-sm text-slate-500">Belum ada proyeksi kebutuhan kas.</p>}
        {forecasts.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Nominal</th>
                  <th className="px-4 py-2 font-medium">Dibutuhkan pada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {forecasts.map((forecast) => (
                  <tr key={forecast.id}>
                    <td className="px-4 py-2 font-medium text-slate-900">{formatRp(forecast.needed_amount)}</td>
                    <td className="px-4 py-2 text-slate-600">{forecast.needed_by_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Riwayat override</h2>
        {overrides.length === 0 && <p className="text-sm text-slate-500">Belum pernah ada override.</p>}
        {overrides.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Aksi</th>
                  <th className="px-4 py-2 font-medium">Alasan</th>
                  <th className="px-4 py-2 font-medium">Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overrides.map((override) => (
                  <tr key={override.id}>
                    <td className="px-4 py-2 text-slate-600">{override.action}</td>
                    <td className="px-4 py-2 text-slate-900">{override.reason}</td>
                    <td className="px-4 py-2 text-slate-600">{new Date(override.created_at).toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
