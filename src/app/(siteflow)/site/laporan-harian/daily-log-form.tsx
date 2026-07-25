'use client';

import { useActionState } from 'react';
import { createDailyLogAction } from '@/modules/field-reporting';
import { submitOrQueueOffline } from '../../submit-with-offline-fallback';
import { Card, Button, Input, Textarea, Label } from '@/core/ui';

type FormState = { status: 'idle' | 'ok' | 'offline' | 'error'; message: string | null };
const initialState: FormState = { status: 'idle', message: null };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DailyLogForm({ projectId }: { projectId: string }) {
  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData): Promise<FormState> => {
    const manpowerRaw = String(formData.get('manpowerCount') ?? '').trim();

    const result = await submitOrQueueOffline(
      'daily_log',
      {
        id: crypto.randomUUID(),
        projectId,
        logDate: String(formData.get('logDate') ?? today()),
        weather: String(formData.get('weather') ?? '').trim() || undefined,
        manpowerCount: manpowerRaw === '' ? undefined : Number(manpowerRaw),
        notes: String(formData.get('notes') ?? '').trim() || undefined,
      },
      createDailyLogAction,
    );

    if (result.status === 'error') return { status: 'error', message: result.message };
    if (result.status === 'offline') return { status: 'offline', message: 'Tersimpan offline. Akan sinkron otomatis saat online.' };
    return { status: 'ok', message: 'Laporan harian tersimpan.' };
  }, initialState);

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="logDate">Tanggal</Label>
          <Input id="logDate" name="logDate" type="date" defaultValue={today()} required />
        </div>

        <div>
          <Label htmlFor="weather">Cuaca</Label>
          <Input id="weather" name="weather" placeholder="mis. Cerah, Hujan siang" />
        </div>

        <div>
          <Label htmlFor="manpowerCount">Jumlah pekerja</Label>
          <Input id="manpowerCount" name="manpowerCount" type="number" min={0} inputMode="numeric" />
        </div>

        <div>
          <Label htmlFor="notes">Catatan</Label>
          <Textarea id="notes" name="notes" rows={3} placeholder="Catatan tambahan (opsional)" />
        </div>

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? 'Menyimpan...' : 'Simpan Laporan'}
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
