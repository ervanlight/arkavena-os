'use client';

import { useActionState } from 'react';
import { createProgressEntryAction } from '@/modules/field-reporting';
import { submitOrQueueOffline } from '../../submit-with-offline-fallback';
import { Card, Button, Input, Select, Textarea, Label } from '@/core/ui';

type WorkPackage = { id: string; name: string };

type FormState = { status: 'idle' | 'ok' | 'offline' | 'error'; message: string | null };
const initialState: FormState = { status: 'idle', message: null };

export function ProgressForm({
  projectId,
  dailyLogId,
  workPackages,
}: {
  projectId: string;
  dailyLogId: string;
  workPackages: WorkPackage[];
}) {
  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData): Promise<FormState> => {
    const result = await submitOrQueueOffline(
      'progress_entry',
      {
        id: crypto.randomUUID(),
        projectId,
        dailyLogId,
        workPackageId: String(formData.get('workPackageId')),
        progressPercent: Number(formData.get('progressPercent')),
        notes: String(formData.get('notes') ?? '').trim() || undefined,
      },
      createProgressEntryAction,
    );

    if (result.status === 'error') return { status: 'error', message: result.message };
    if (result.status === 'offline') return { status: 'offline', message: 'Tersimpan offline. Akan sinkron otomatis saat online.' };
    return { status: 'ok', message: 'Progress tersimpan.' };
  }, initialState);

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="workPackageId">Paket kerja</Label>
          <Select id="workPackageId" name="workPackageId" required>
            {workPackages.map((wp) => (
              <option key={wp.id} value={wp.id}>
                {wp.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="progressPercent">Progress (%)</Label>
          <Input id="progressPercent" name="progressPercent" type="number" min={0} max={100} inputMode="numeric" required />
        </div>

        <div>
          <Label htmlFor="notes">Catatan</Label>
          <Textarea id="notes" name="notes" rows={3} placeholder="Catatan tambahan (opsional)" />
        </div>

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? 'Menyimpan...' : 'Simpan Progress'}
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
