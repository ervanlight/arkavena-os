'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { rejectChangeOrderAction, sendChangeOrderToClientAction } from '@/modules/scope-variation';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

export function ReviewForm({ changeOrderId }: { changeOrderId: string }) {
  const router = useRouter();

  const [sendState, sendAction, isSending] = useActionState(async (_prev: FormState) => {
    const result = await sendChangeOrderToClientAction(changeOrderId);
    if (!result.ok) return { error: result.error.message };
    router.refresh();
    return { error: null };
  }, initialState);

  const [rejectState, rejectAction, isRejecting] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await rejectChangeOrderAction({
      id: changeOrderId,
      reason: String(formData.get('reason') ?? ''),
    });
    if (!result.ok) return { error: result.error.message };
    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <div className="space-y-4">
      <form action={sendAction} className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSending}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {isSending ? 'Mengirim...' : 'Kirim ke klien'}
        </button>
        {sendState.error !== null && (
          <span role="alert" className="text-sm text-red-600">
            {sendState.error}
          </span>
        )}
      </form>

      <form action={rejectAction} className="space-y-2 border-t border-slate-100 pt-4">
        <label htmlFor="reviewRejectReason" className="block text-xs font-medium text-slate-700">
          Atau tolak variation ini (alasan wajib)
        </label>
        <textarea
          id="reviewRejectReason"
          name="reason"
          rows={2}
          required
          placeholder="mis. Estimasi tidak masuk akal"
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
        <button
          type="submit"
          disabled={isRejecting}
          className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          {isRejecting ? 'Menolak...' : 'Tolak variation'}
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
