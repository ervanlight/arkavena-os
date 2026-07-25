'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createFundingReceiptAction } from '@/modules/cash-gate';
import { Label, Input, Button } from '@/core/ui';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

export function FundingReceiptForm({ projectId }: { projectId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await createFundingReceiptAction({
      projectId,
      amount: String(formData.get('amount') ?? ''),
      expectedDate: String(formData.get('expectedDate') ?? ''),
    });

    if (!result.ok) {
      return { error: result.error.message };
    }

    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div>
        <Label htmlFor="receiptAmount">Nominal (Rp)</Label>
        <Input
          id="receiptAmount"
          name="amount"
          required
          inputMode="numeric"
          pattern="\d+"
          placeholder="mis. 50000000"
          className="w-40"
        />
      </div>
      <div>
        <Label htmlFor="receiptExpectedDate">Diharapkan cair</Label>
        <Input id="receiptExpectedDate" name="expectedDate" type="date" required />
      </div>
      <Button type="submit" disabled={isPending} size="sm">
        {isPending ? 'Menyimpan...' : 'Catat termin'}
      </Button>
      {state.error !== null && (
        <p role="alert" className="w-full text-sm text-[color:var(--color-danger)]">
          {state.error}
        </p>
      )}
    </form>
  );
}
