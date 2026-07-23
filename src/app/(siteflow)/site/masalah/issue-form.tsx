'use client';

import { useActionState, useRef, useState } from 'react';
import { createIssueAction } from '@/modules/field-reporting';
import { generateIssueClassificationAction } from '@/modules/ai-scribe';
import { submitOrQueueOffline } from '../../submit-with-offline-fallback';

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
    <form action={formAction} className="space-y-4 rounded-lg bg-white p-4 shadow-sm">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-slate-700">
          Judul masalah
        </label>
        <input
          ref={titleRef}
          id="title"
          name="title"
          required
          placeholder="mis. Retak dinding lantai 2"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-slate-700">
          Keterangan
        </label>
        <textarea
          ref={descriptionRef}
          id="description"
          name="description"
          rows={3}
          placeholder="Jelaskan masalahnya (opsional)"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      <div>
        <button
          type="button"
          onClick={handleAssist}
          disabled={assist.status === 'loading'}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
        >
          {assist.status === 'loading' ? 'Meminta saran...' : 'Saran otomatis (AI)'}
        </button>
        {assist.status === 'suggested' && (
          <p className="mt-1 text-sm text-slate-600">
            Kategori tersarankan: <span className="font-medium">{assist.category}</span>. Tingkat keparahan di atas
            sudah diisi otomatis -- periksa sebelum mengirim.
          </p>
        )}
        {assist.status === 'error' && (
          <p role="alert" className="mt-1 text-sm text-red-600">
            {assist.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="severity" className="block text-sm font-medium text-slate-700">
          Tingkat keparahan
        </label>
        <select
          ref={severityRef}
          id="severity"
          name="severity"
          defaultValue="medium"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="low">Ringan</option>
          <option value="medium">Sedang</option>
          <option value="high">Berat</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-slate-900 px-3 py-3 text-base font-medium text-white disabled:opacity-50"
      >
        {isPending ? 'Mengirim...' : 'Lapor Masalah'}
      </button>

      {state.status === 'error' && (
        <p role="alert" className="text-sm text-red-600">
          {state.message}
        </p>
      )}
      {state.status === 'offline' && <p className="text-sm text-amber-600">{state.message}</p>}
      {state.status === 'ok' && <p className="text-sm text-emerald-600">{state.message}</p>}
    </form>
  );
}
