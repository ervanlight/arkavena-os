'use client';

import { useActionState, useRef, useState } from 'react';
import { createIssueAction } from '@/modules/field-reporting';
import { generateIssueClassificationAction } from '@/modules/ai-scribe';
import { submitOrQueueOffline } from '../../submit-with-offline-fallback';
import { Card, Button, Input, Select, Textarea, Label } from '@/core/ui';

type FormState = { status: 'idle' | 'ok' | 'offline' | 'error'; message: string | null };
const initialState: FormState = { status: 'idle', message: null };

type AssistState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'suggested'; category: string }
  | { status: 'error'; message: string };

export function IssueForm({ projectId }: { projectId: string }) {
  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const severityRef = useRef<HTMLSelectElement>(null);
  const [assist, setAssist] = useState<AssistState>({ status: 'idle' });

  /**
   * Online-only (SiteFlow's outbox is for the submit itself, not this):
   * a classification suggestion nobody asked to see while offline isn't
   * worth queuing and replaying later the way a report is.
   */
  async function handleAssist() {
    if (!navigator.onLine) {
      setAssist({ status: 'error', message: 'Perlu koneksi internet untuk saran otomatis.' });
      return;
    }

    const title = titleRef.current?.value.trim() ?? '';
    if (title === '') {
      setAssist({ status: 'error', message: 'Isi judul masalah dulu.' });
      return;
    }

    setAssist({ status: 'loading' });
    const description = descriptionRef.current?.value.trim();
    const result = await generateIssueClassificationAction({
      title,
      ...(description !== undefined && description !== '' ? { description } : {}),
    });

    if (!result.ok) {
      setAssist({ status: 'error', message: result.error.message });
      return;
    }

    if (severityRef.current !== null) severityRef.current.value = result.data.suggestedSeverity;
    setAssist({ status: 'suggested', category: result.data.suggestedCategory });
  }

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData): Promise<FormState> => {
    const result = await submitOrQueueOffline(
      'issue',
      {
        id: crypto.randomUUID(),
        projectId,
        title: String(formData.get('title') ?? '').trim(),
        description: String(formData.get('description') ?? '').trim() || undefined,
        severity: String(formData.get('severity') ?? 'medium') as 'low' | 'medium' | 'high',
      },
      createIssueAction,
    );

    if (result.status === 'error') return { status: 'error', message: result.message };
    if (result.status === 'offline') return { status: 'offline', message: 'Tersimpan offline. Akan sinkron otomatis saat online.' };
    return { status: 'ok', message: 'Masalah dilaporkan.' };
  }, initialState);

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="title">Judul masalah</Label>
          <Input ref={titleRef} id="title" name="title" required placeholder="mis. Retak dinding lantai 2" />
        </div>

        <div>
          <Label htmlFor="description">Keterangan</Label>
          <Textarea
            ref={descriptionRef}
            id="description"
            name="description"
            rows={3}
            placeholder="Jelaskan masalahnya (opsional)"
          />
        </div>

        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={handleAssist}
            disabled={assist.status === 'loading'}
            className="w-full"
          >
            {assist.status === 'loading' ? 'Meminta saran...' : 'Saran otomatis (AI)'}
          </Button>
          {assist.status === 'suggested' && (
            <p className="mt-1 text-sm text-[color:var(--color-ink-secondary)]">
              Kategori tersarankan: <span className="font-medium">{assist.category}</span>. Tingkat keparahan di atas
              sudah diisi otomatis -- periksa sebelum mengirim.
            </p>
          )}
          {assist.status === 'error' && (
            <p role="alert" className="mt-1 text-sm text-[color:var(--color-danger)]">
              {assist.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="severity">Tingkat keparahan</Label>
          <Select ref={severityRef} id="severity" name="severity" defaultValue="medium">
            <option value="low">Ringan</option>
            <option value="medium">Sedang</option>
            <option value="high">Berat</option>
          </Select>
        </div>

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? 'Mengirim...' : 'Lapor Masalah'}
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
