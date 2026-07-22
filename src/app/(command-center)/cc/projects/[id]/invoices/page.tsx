import type { Route } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatRp, toRupiah } from '@/core/money/rupiah';
import { getCurrentUser } from '@/core/auth/session';
import { roleCan } from '@/core/permissions/matrix';
import {
  getProjectAction,
  listContractsForProjectAction,
  listMilestonesForContractAction,
} from '@/modules/projects';
import { listChangeOrdersForProjectAction } from '@/modules/scope-variation';
import { getInvoiceIssuanceStatusAction, listInvoicesForProjectAction, listPaymentsForInvoiceAction } from '@/modules/billing';
import { CreateInvoiceForm } from './create-invoice-form';
import { IssueInvoiceForm } from './issue-invoice-form';
import { CancelInvoiceForm } from './cancel-invoice-form';
import { RecordPaymentForm } from './record-payment-form';

export const metadata = { title: 'Invoice — BuildTrust OS' };

const INVOICE_STATUS_LABEL_ID: Record<string, string> = {
  draft: 'Draft',
  issued: 'Terbit',
  paid: 'Lunas',
  cancelled: 'Dibatalkan',
};

const INVOICE_STATUS_BADGE_CLASS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  issued: 'bg-blue-100 text-blue-800',
  paid: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default async function ProjectInvoicesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const [projectResult, contractsResult, changeOrdersResult, invoicesResult, user] = await Promise.all([
    getProjectAction(projectId),
    listContractsForProjectAction(projectId),
    listChangeOrdersForProjectAction(projectId),
    listInvoicesForProjectAction(projectId),
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
  const contracts = contractsResult.ok ? contractsResult.data : [];
  const milestoneLists = await Promise.all(contracts.map((c) => listMilestonesForContractAction(c.id)));
  const milestones = milestoneLists.flatMap((result) => (result.ok ? result.data : []));
  const milestoneNameById = new Map(milestones.map((m) => [m.id, m.name]));

  const changeOrders = changeOrdersResult.ok ? changeOrdersResult.data : [];
  const invoices = invoicesResult.ok ? invoicesResult.data : [];

  const isTechnicalDirector = roleCan(user?.orgRole ?? null, 'invoice', 'issue');

  const issuanceStatuses = await Promise.all(
    invoices
      .filter((invoice) => invoice.status === 'draft')
      .map(async (invoice) => {
        const result = await getInvoiceIssuanceStatusAction(invoice.id);
        if (!result.ok) return [invoice.id, [result.error.message]] as const;
        return [invoice.id, result.data.ok ? [] : result.data.error.reasons] as const;
      }),
  );
  const blockedReasonsByInvoiceId = new Map(issuanceStatuses);

  const paymentLists = await Promise.all(
    invoices
      .filter((invoice) => invoice.status === 'issued' || invoice.status === 'paid')
      .map(async (invoice) => {
        const result = await listPaymentsForInvoiceAction(invoice.id);
        return [invoice.id, result.ok ? result.data : []] as const;
      }),
  );
  const paymentsByInvoiceId = new Map(paymentLists);

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/cc/projects/${project.id}`} className="text-sm text-slate-500 hover:text-slate-900">
          ← {project.name}
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">Invoice</h1>
      </div>

      <div className="rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Buat invoice baru</h2>
        <div className="mt-4">
          <CreateInvoiceForm
            projectId={project.id}
            milestones={milestones.map((m) => ({ id: m.id, label: m.name }))}
            changeOrders={changeOrders.map((co) => ({ id: co.id, title: co.title }))}
          />
        </div>
      </div>

      <div className="space-y-4">
        {invoices.length === 0 && <p className="text-sm text-slate-500">Belum ada invoice.</p>}
        {invoices.map((invoice) => {
          const payments = paymentsByInvoiceId.get(invoice.id) ?? [];
          const paidTotal = toRupiah(payments.reduce((sum, p) => sum + p.amount, 0n));
          return (
            <div key={invoice.id} className="rounded-lg bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{invoice.title}</h3>
                  <p className="text-xs text-slate-500">
                    Milestone: {milestoneNameById.get(invoice.milestone_id) ?? '—'} · Jatuh tempo: {invoice.due_date}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">{formatRp(invoice.amount)}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${INVOICE_STATUS_BADGE_CLASS[invoice.status] ?? 'bg-slate-100 text-slate-600'}`}
                  >
                    {INVOICE_STATUS_LABEL_ID[invoice.status] ?? invoice.status}
                  </span>
                </div>
              </div>

              {invoice.status === 'draft' && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {isTechnicalDirector && (
                    <IssueInvoiceForm invoiceId={invoice.id} blockedReasons={blockedReasonsByInvoiceId.get(invoice.id) ?? []} />
                  )}
                  <CancelInvoiceForm invoiceId={invoice.id} />
                </div>
              )}

              {(invoice.status === 'issued' || invoice.status === 'paid') && (
                <div className="mt-3 space-y-2">
                  <Link
                    href={`/cc/projects/${project.id}/invoices/${invoice.id}/billing-pack` as Route}
                    className="text-xs font-medium text-slate-600 underline"
                  >
                    Lihat billing pack
                  </Link>
                  <p className="text-xs text-slate-500">
                    Dibayar: {formatRp(paidTotal)} / {formatRp(invoice.amount)}
                  </p>
                  {invoice.status === 'issued' && <RecordPaymentForm invoiceId={invoice.id} />}
                </div>
              )}

              {invoice.status === 'cancelled' && invoice.cancelled_reason !== null && (
                <p className="mt-2 text-xs text-slate-500">Alasan: {invoice.cancelled_reason}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
