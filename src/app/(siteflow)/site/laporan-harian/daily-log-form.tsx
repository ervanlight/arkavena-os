'use client';

import { useActionState } from 'react';
import { createDailyLogAction } from '@/modules/daily-report-inbox';
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
        <div className="space-y-3">
          <div>
            <Label>Ambil Foto Progres (Wajib)</Label>
            <div className="mt-1 flex h-32 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] text-[color:var(--color-ink-secondary)]">
              <input type="file" accept="image/*" capture="environment" className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-2"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
              <span className="text-sm font-medium">Ketuk untuk Memotret</span>
            </div>
          </div>

          <div>
            <Label>Video Singkat (Opsional)</Label>
            <div className="mt-1 flex h-16 w-full items-center justify-center rounded-xl border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] text-[color:var(--color-ink-secondary)]">
              <input type="file" accept="video/*" capture="environment" className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
              <span className="text-sm font-medium">+ Rekam Video</span>
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Catatan Pekerjaan Hari Ini</Label>
            <Textarea id="notes" name="notes" rows={3} placeholder="Ceritakan apa yang dikerjakan hari ini..." required />
          </div>
        </div>

        <Button type="submit" disabled={isPending} variant="primary" className="w-full mt-6 py-6 text-lg font-bold">
          {isPending ? 'Mengirim...' : 'Kirim Laporan'}
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
