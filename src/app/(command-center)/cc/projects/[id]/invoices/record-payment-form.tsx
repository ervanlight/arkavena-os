'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { recordPaymentAction } from '@/modules/invoice-generator';
import { Input, Button } from '@/core/ui';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

export function RecordPaymentForm({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await recordPaymentAction({
      invoiceId,
      amount: String(formData.get('amount') ?? '').trim(),
    });
    if (!result.ok) return { error: result.error.message };
    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="mt-2 flex flex-wrap items-center gap-2">
      <Input name="amount" required placeholder="Nominal dibayar (Rp)" className="w-40" />
      <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
        {isPending ? 'Menyimpan...' : 'Catat pembayaran'}
      </Button>
      {state.error !== null && (
        <span role="alert" className="text-xs text-[color:var(--color-danger)]">
          {state.error}
        </span>
      )}
    </form>
  );
}
