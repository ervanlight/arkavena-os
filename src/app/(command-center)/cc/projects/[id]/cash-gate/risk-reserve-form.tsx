'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { setRiskReserveAction } from '@/modules/cash-gate';
import { Label, Input, Button } from '@/core/ui';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

export function RiskReserveForm({ projectId, currentAmount }: { projectId: string; currentAmount: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await setRiskReserveAction({
      projectId,
      riskReserveAmount: String(formData.get('riskReserveAmount') ?? ''),
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
        <Label htmlFor="riskReserveAmount">Nominal cadangan (Rp)</Label>
        <Input
          id="riskReserveAmount"
          name="riskReserveAmount"
          required
          inputMode="numeric"
          pattern="\d+"
          defaultValue={currentAmount}
          className="w-40"
        />
      </div>
      <Button type="submit" disabled={isPending} size="sm">
        {isPending ? 'Menyimpan...' : 'Simpan'}
      </Button>
      {state.error !== null && (
        <p role="alert" className="w-full text-sm text-[color:var(--color-danger)]">
          {state.error}
        </p>
      )}
    </form>
  );
}
