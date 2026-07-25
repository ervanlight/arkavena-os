'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { clientApproveChangeOrderAction, clientRejectChangeOrderAction } from '@/modules/scope-variation';
import { Button, Input, Textarea, Label } from '@/core/ui';

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
        <Label htmlFor="approveReason">Catatan persetujuan</Label>
        <Input id="approveReason" name="approveReason" required placeholder="mis. Setuju, silakan lanjutkan" />
        <Button type="submit" disabled={isApproving} className="w-full">
          {isApproving ? 'Mengirim...' : 'Setujui variation ini'}
        </Button>
        {approveState.error !== null && (
          <p role="alert" className="text-sm text-[color:var(--color-danger)]">
            {approveState.error}
          </p>
        )}
      </form>

      <form action={rejectAction} className="space-y-2 border-t border-[color:var(--color-hairline)] pt-6">
        <Label htmlFor="rejectReason">Atau tolak (alasan wajib)</Label>
        <Textarea id="rejectReason" name="rejectReason" rows={2} required placeholder="mis. Terlalu mahal, tidak jadi" />
        <Button type="submit" variant="destructive" disabled={isRejecting} className="w-full">
          {isRejecting ? 'Mengirim...' : 'Tolak variation ini'}
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
