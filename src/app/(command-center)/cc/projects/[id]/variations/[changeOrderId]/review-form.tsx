'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { rejectChangeOrderAction, sendChangeOrderToClientAction } from '@/modules/scope-variation';
import { Button, Label, Textarea } from '@/core/ui';

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
        <Button type="submit" disabled={isSending}>
          {isSending ? 'Mengirim...' : 'Kirim ke klien'}
        </Button>
        {sendState.error !== null && (
          <span role="alert" className="text-sm text-[color:var(--color-danger)]">
            {sendState.error}
          </span>
        )}
      </form>

      <form action={rejectAction} className="space-y-2 border-t border-[color:var(--color-hairline)] pt-4">
        <Label htmlFor="reviewRejectReason">Atau tolak variation ini (alasan wajib)</Label>
        <Textarea
          id="reviewRejectReason"
          name="reason"
          rows={2}
          required
          placeholder="mis. Estimasi tidak masuk akal"
        />
        <Button type="submit" variant="destructive" disabled={isRejecting}>
          {isRejecting ? 'Menolak...' : 'Tolak variation'}
        </Button>
        {rejectState.error !== null && (
          <p role="alert" className="text-sm text-[color:var(--color-danger)]">
            {rejectState.error}
          </p>
        )}
      </form>
    </div>
  );
}
