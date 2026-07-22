'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createInvoiceAction } from '@/modules/billing';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

type MilestoneOption = { id: string; label: string };
type ChangeOrderOption = { id: string; title: string };

export function CreateInvoiceForm({
  projectId,
  milestones,
  changeOrders,
}: {
  projectId: string;
  milestones: MilestoneOption[];
  changeOrders: ChangeOrderOption[];
}) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const changeOrderId = String(formData.get('changeOrderId') ?? '');
    const result = await createInvoiceAction({
      projectId,
      milestoneId: String(formData.get('milestoneId') ?? ''),
      changeOrderId: changeOrderId === '' ? undefined : changeOrderId,
      title: String(formData.get('title') ?? '').trim(),
      amount: String(formData.get('amount') ?? '').trim(),
      dueDate: String(formData.get('dueDate') ?? ''),
    });

    if (!result.ok) return { error: result.error.message };
    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor="invoiceTitle" className="block text-xs font-medium text-slate-700">
          Judul invoice
        </label>
        <input
          id="invoiceTitle"
          name="title"
          required
          placeholder="mis. Termin 1 - Pekerjaan Pondasi"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="invoiceMilestoneId" className="block text-xs font-medium text-slate-700">
          Milestone
        </label>
        <select
          id="invoiceMilestoneId"
          name="milestoneId"
          required
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="">Pilih milestone</option>
          {milestones.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="invoiceChangeOrderId" className="block text-xs font-medium text-slate-700">
          Variation terkait (opsional)
        </label>
        <select
          id="invoiceChangeOrderId"
          name="changeOrderId"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="">Tidak ada</option>
          {changeOrders.map((co) => (
            <option key={co.id} value={co.id}>
              {co.title}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="invoiceAmount" className="block text-xs font-medium text-slate-700">
          Nominal (Rp)
        </label>
        <input
          id="invoiceAmount"
          name="amount"
          required
          placeholder="mis. 50000000"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="invoiceDueDate" className="block text-xs font-medium text-slate-700">
          Jatuh tempo
        </label>
        <input
          id="invoiceDueDate"
          name="dueDate"
          type="date"
          required
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {isPending ? 'Menyimpan...' : 'Buat invoice (draft)'}
        </button>
      </div>
      {state.error !== null && (
        <p role="alert" className="text-sm text-red-600 sm:col-span-2">
          {state.error}
        </p>
      )}
    </form>
  );
}
