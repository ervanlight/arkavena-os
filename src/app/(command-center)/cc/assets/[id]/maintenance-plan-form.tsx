'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createMaintenancePlanAction } from '@/modules/maintenance-engine';
import { Label, Input, Button } from '@/core/ui';

type FormState = { error: string | null };

export function CreateMaintenancePlanForm({ assetId }: { assetId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await createMaintenancePlanAction({
      assetId,
      title: String(formData.get('title') ?? ''),
      intervalDays: Number(formData.get('intervalDays') ?? 0),
      startsAt: String(formData.get('startsAt') ?? ''),
    });

    if (!result.ok) {
      return { error: result.error.message };
    }

    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-4">
      <div>
        <Label htmlFor="planTitle">Judul jadwal *</Label>
        <Input id="planTitle" name="title" required placeholder="Servis rutin AC" />
      </div>
      <div>
        <Label htmlFor="intervalDays">Interval (hari) *</Label>
        <Input id="intervalDays" name="intervalDays" type="number" min={1} required />
      </div>
      <div>
        <Label htmlFor="startsAt">Mulai *</Label>
        <Input id="startsAt" name="startsAt" type="date" required />
      </div>

      {state.error !== null && (
        <p role="alert" className="col-span-full text-sm text-[color:var(--color-danger)]">
          {state.error}
        </p>
      )}

      <div className="col-span-full">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Menyimpan...' : 'Tambah jadwal perawatan'}
        </Button>
      </div>
    </form>
  );
}

const initialState: FormState = { error: null };
