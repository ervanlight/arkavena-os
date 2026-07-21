'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { clientApproveChangeOrderAction, clientRejectChangeOrderAction } from '@/modules/scope-variation';

type FormState = { error: string | null; ok: boolean };
const initialState: FormState = { error: null, ok: false };

export function ClientDecisionForm({ changeOrderId }: { changeOrderId: string }) {
  const router = useRouter();

  const [approveState, approveAction, isApproving] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await clientApproveChangeOrderAction({
      id: changeOrderId,
      reason: String(formData.get('approveReason') ?? ''),
    });
    if (!result.ok) return { error: result.error.message, ok: false };
    router.refresh();
    return { error: null, ok: true };
  }, initialState);

  const [rejectState, rejectAction, isRejecting] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await clientRejectChangeOrderAction({
      id: changeOrderId,
      reason: String(formData.get('rejectReason') ?? ''),
    });
    if (!result.ok) return { error: result.error.message, ok: false };
    router.refresh();
    return { error: null, ok: true };
  }, initialState);

  return (
    <div className="space-y-6">
      <form action={approveAction} className="space-y-2">
        <label htmlFor="approveReason" className="block text-xs font-medium text-slate-700">
          Catatan persetujuan
        </label>
        <input
          id="approveReason"
          name="approveReason"
          required
          placeholder="mis. Setuju, silakan lanjutkan"
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
        <button
          type="submit"
          disabled={isApproving}
          className="w-full rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {isApproving ? 'Mengirim...' : 'Setujui variation ini'}
        </button>
        {approveState.error !== null && (
          <p role="alert" className="text-sm text-red-600">
            {approveState.error}
          </p>
        )}
      </form>

      <form action={rejectAction} className="space-y-2 border-t border-slate-100 pt-6">
        <label htmlFor="rejectReason" className="block text-xs font-medium text-slate-700">
          Atau tolak (alasan wajib)
        </label>
        <textarea
          id="rejectReason"
          name="rejectReason"
          rows={2}
          required
          placeholder="mis. Terlalu mahal, tidak jadi"
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
        <button
          type="submit"
          disabled={isRejecting}
          className="w-full rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          {isRejecting ? 'Mengirim...' : 'Tolak variation ini'}
        </button>
        {rejectState.error !== null && (
          <p role="alert" className="text-sm text-red-600">
            {rejectState.error}
          </p>
        )}
      </form>
    </div>
  );
}
