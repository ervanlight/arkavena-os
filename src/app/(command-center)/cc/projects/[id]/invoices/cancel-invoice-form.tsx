'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { cancelInvoiceAction } from '@/modules/billing';
import { Input, Button } from '@/core/ui';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

export function CancelInvoiceForm({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const reason = String(formData.get('reason') ?? '');
    const result = await cancelInvoiceAction({ id: invoiceId, reason });
    if (!result.ok) return { error: result.error.message };
    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="mt-2 flex flex-wrap items-center gap-2">
      <Input name="reason" required placeholder="Alasan pembatalan" className="w-56" />
      <Button type="submit" variant="destructive" size="sm" disabled={isPending}>
        {isPending ? 'Membatalkan...' : 'Batalkan'}
      </Button>
      {state.error !== null && (
        <span role="alert" className="text-xs text-[color:var(--color-danger)]">
          {state.error}
        </span>
      )}
    </form>
  );
}
