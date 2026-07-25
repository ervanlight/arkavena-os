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
import { Card, StatusBadge, EmptyState } from '@/core/ui';
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

const INVOICE_STATUS_TONE: Record<string, 'neutral' | 'info' | 'success' | 'danger'> = {
  draft: 'neutral',
  issued: 'info',
  paid: 'success',
  cancelled: 'danger',
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
      <p role="alert" className="text-sm text-[color:var(--color-danger)]">
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
      <Card>
        <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Buat invoice baru</h2>
        <div className="mt-4">
          <CreateInvoiceForm
            projectId={project.id}
            milestones={milestones.map((m) => ({ id: m.id, label: m.name }))}
            changeOrders={changeOrders.map((co) => ({ id: co.id, title: co.title }))}
          />
        </div>
      </Card>

      <div className="space-y-4">
        {invoices.length === 0 && <EmptyState title="Belum ada invoice." />}
        {invoices.map((invoice) => {
          const payments = paymentsByInvoiceId.get(invoice.id) ?? [];
          const paidTotal = toRupiah(payments.reduce((sum, p) => sum + p.amount, 0n));
          return (
            <Card key={invoice.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-[15px] font-semibold text-[color:var(--color-ink)]">{invoice.title}</h3>
                  <p className="text-xs text-[color:var(--color-ink-tertiary)]">
                    Milestone: {milestoneNameById.get(invoice.milestone_id) ?? '—'} · Jatuh tempo: {invoice.due_date}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-medium text-[color:var(--color-ink)]">{formatRp(invoice.amount)}</span>
                  <StatusBadge tone={INVOICE_STATUS_TONE[invoice.status] ?? 'neutral'}>
                    {INVOICE_STATUS_LABEL_ID[invoice.status] ?? invoice.status}
                  </StatusBadge>
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
                    className="text-xs font-medium text-[color:var(--color-ink-secondary)] underline"
                  >
                    Lihat billing pack
                  </Link>
                  <p className="text-xs text-[color:var(--color-ink-tertiary)]">
                    Dibayar: {formatRp(paidTotal)} / {formatRp(invoice.amount)}
                  </p>
                  {invoice.status === 'issued' && <RecordPaymentForm invoiceId={invoice.id} />}
                </div>
              )}

              {invoice.status === 'cancelled' && invoice.cancelled_reason !== null && (
                <p className="mt-2 text-xs text-[color:var(--color-ink-tertiary)]">Alasan: {invoice.cancelled_reason}</p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
