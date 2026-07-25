'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createCashForecastAction } from '@/modules/cash-gate';
import { Label, Input, Button } from '@/core/ui';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

export function CashForecastForm({ projectId }: { projectId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await createCashForecastAction({
      projectId,
      amount: String(formData.get('amount') ?? ''),
      neededByDate: String(formData.get('neededByDate') ?? ''),
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
        <Label htmlFor="forecastAmount">Nominal (Rp)</Label>
        <Input
          id="forecastAmount"
          name="amount"
          required
          inputMode="numeric"
          pattern="\d+"
          placeholder="mis. 30000000"
          className="w-40"
        />
      </div>
      <div>
        <Label htmlFor="forecastNeededByDate">Dibutuhkan pada</Label>
        <Input id="forecastNeededByDate" name="neededByDate" type="date" required />
      </div>
      <Button type="submit" disabled={isPending} size="sm">
        {isPending ? 'Menyimpan...' : 'Tambah proyeksi'}
      </Button>
      {state.error !== null && (
        <p role="alert" className="w-full text-sm text-[color:var(--color-danger)]">
          {state.error}
        </p>
      )}
    </form>
  );
}
