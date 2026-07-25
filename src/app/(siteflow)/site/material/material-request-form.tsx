'use client';

import { useActionState } from 'react';
import { createMaterialRequestAction } from '@/modules/field-reporting';
import { submitOrQueueOffline } from '../../submit-with-offline-fallback';
import { Card, Button, Input, Textarea, Label } from '@/core/ui';

type FormState = { status: 'idle' | 'ok' | 'offline' | 'error'; message: string | null };
const initialState: FormState = { status: 'idle', message: null };

export function MaterialRequestForm({ projectId }: { projectId: string }) {
  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData): Promise<FormState> => {
    const neededByDate = String(formData.get('neededByDate') ?? '').trim();

    const result = await submitOrQueueOffline(
      'material_request',
      {
        id: crypto.randomUUID(),
        projectId,
        itemDescription: String(formData.get('itemDescription') ?? '').trim(),
        quantity: Number(formData.get('quantity')),
        unit: String(formData.get('unit') ?? '').trim(),
        neededByDate: neededByDate === '' ? undefined : neededByDate,
        notes: String(formData.get('notes') ?? '').trim() || undefined,
      },
      createMaterialRequestAction,
    );

    if (result.status === 'error') return { status: 'error', message: result.message };
    if (result.status === 'offline') return { status: 'offline', message: 'Tersimpan offline. Akan sinkron otomatis saat online.' };
    return { status: 'ok', message: 'Permintaan material terkirim.' };
  }, initialState);

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="itemDescription">Nama material</Label>
          <Input id="itemDescription" name="itemDescription" required placeholder="mis. Semen 50kg" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="quantity">Jumlah</Label>
            <Input id="quantity" name="quantity" type="number" min={0} step="any" inputMode="decimal" required />
          </div>
          <div>
            <Label htmlFor="unit">Satuan</Label>
            <Input id="unit" name="unit" required placeholder="mis. sak, kubik" />
          </div>
        </div>

        <div>
          <Label htmlFor="neededByDate">Dibutuhkan sebelum</Label>
          <Input id="neededByDate" name="neededByDate" type="date" />
        </div>

        <div>
          <Label htmlFor="notes">Catatan</Label>
          <Textarea id="notes" name="notes" rows={3} placeholder="Catatan tambahan (opsional)" />
        </div>

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? 'Mengirim...' : 'Kirim Permintaan'}
        </Button>

        {state.status === 'error' && (
          <p role="alert" className="text-sm text-[color:var(--color-danger)]">
            {state.message}
          </p>
        )}
        {state.status === 'offline' && <p className="text-sm text-[color:var(--color-warning)]">{state.message}</p>}
        {state.status === 'ok' && <p className="text-sm text-[color:var(--color-success)]">{state.message}</p>}
      </form>
    </Card>
  );
}
