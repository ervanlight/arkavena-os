'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { setChangeOrderImpactAction } from '@/modules/variations';
import { Button, Input, Label } from '@/core/ui';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

export function SetImpactForm({
  changeOrderId,
  currentCostImpact,
  currentScheduleImpact,
}: {
  changeOrderId: string;
  currentCostImpact: string;
  currentScheduleImpact: number | string;
}) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await setChangeOrderImpactAction({
      id: changeOrderId,
      costImpactAmount: String(formData.get('costImpactAmount') ?? ''),
      scheduleImpactDays: Number(formData.get('scheduleImpactDays') ?? 0),
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
        <Label htmlFor="costImpactAmount">Dampak biaya (Rp, boleh minus untuk pengurangan)</Label>
        <Input
          id="costImpactAmount"
          name="costImpactAmount"
          required
          inputMode="numeric"
          pattern="-?\d+"
          defaultValue={currentCostImpact}
          placeholder="mis. 45000000 atau -5000000"
          className="w-52"
        />
      </div>
      <div>
        <Label htmlFor="scheduleImpactDays">Dampak jadwal (hari, boleh minus)</Label>
        <Input
          id="scheduleImpactDays"
          name="scheduleImpactDays"
          type="number"
          required
          defaultValue={currentScheduleImpact}
          className="w-32"
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Menyimpan...' : 'Simpan estimasi'}
      </Button>
      {state.error !== null && (
        <p role="alert" className="w-full text-sm text-[color:var(--color-danger)]">
          {state.error}
        </p>
      )}
    </form>
  );
}
