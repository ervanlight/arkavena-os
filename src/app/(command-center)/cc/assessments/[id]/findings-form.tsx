'use client';

import { useActionState, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateAssessmentFindingsAction } from '@/modules/assessment';
import { generateAssessmentScopeDraftAction } from '@/modules/ai-scribe';

type FormState = { error: string | null };

type AssistState = { status: 'idle' } | { status: 'loading' } | { status: 'suggested' } | { status: 'error'; message: string };

export function FindingsForm({
  assessmentId,
  siteConditions,
  recommendedScope,
  notes,
  disabled,
}: {
  assessmentId: string;
  siteConditions: string | null;
  recommendedScope: string | null;
  notes: string | null;
  disabled: boolean;
}) {
  const router = useRouter();
  const recommendedScopeRef = useRef<HTMLTextAreaElement>(null);
  const [assist, setAssist] = useState<AssistState>({ status: 'idle' });

  /** Draft only -- fills the same textarea the human still reviews and saves via the form below (ADR 0020 SS2). */
  async function handleAssist() {
    setAssist({ status: 'loading' });
    const result = await generateAssessmentScopeDraftAction({ assessmentId });

    if (!result.ok) {
      setAssist({ status: 'error', message: result.error.message });
      return;
    }

    if (recommendedScopeRef.current !== null) recommendedScopeRef.current.value = result.data.suggestedScope;
    setAssist({ status: 'suggested' });
  }

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await updateAssessmentFindingsAction({
      id: assessmentId,
      siteConditions: String(formData.get('siteConditions') ?? '') || undefined,
      recommendedScope: String(formData.get('recommendedScope') ?? '') || undefined,
      notes: String(formData.get('notes') ?? '') || undefined,
    });

    if (!result.ok) {
      return { error: result.error.message };
    }

    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      <div>
        <label htmlFor="siteConditions" className="block text-sm font-medium text-slate-700">
          Kondisi lokasi
        </label>
        <textarea
          id="siteConditions"
          name="siteConditions"
          rows={3}
          disabled={disabled}
          defaultValue={siteConditions ?? ''}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:bg-slate-50 disabled:text-slate-500"
        />
      </div>
      <div>
        <label htmlFor="recommendedScope" className="block text-sm font-medium text-slate-700">
          Ruang lingkup direkomendasikan
        </label>
        <textarea
          ref={recommendedScopeRef}
          id="recommendedScope"
          name="recommendedScope"
          rows={3}
          disabled={disabled}
          defaultValue={recommendedScope ?? ''}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:bg-slate-50 disabled:text-slate-500"
        />
        {!disabled && (
          <div className="mt-1">
            <button
              type="button"
              onClick={handleAssist}
              disabled={assist.status === 'loading'}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50"
            >
              {assist.status === 'loading' ? 'Meminta saran...' : 'Saran otomatis (AI)'}
            </button>
            {assist.status === 'suggested' && (
              <p className="mt-1 text-sm text-slate-600">Draf terisi otomatis -- periksa dan sunting sebelum menyimpan.</p>
            )}
            {assist.status === 'error' && (
              <p role="alert" className="mt-1 text-sm text-red-600">
                {assist.message}
              </p>
            )}
          </div>
        )}
      </div>
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-slate-700">
          Catatan
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          disabled={disabled}
          defaultValue={notes ?? ''}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:bg-slate-50 disabled:text-slate-500"
        />
      </div>

      {state.error !== null && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      {!disabled && (
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {isPending ? 'Menyimpan...' : 'Simpan temuan'}
        </button>
      )}
    </form>
  );
}

const initialState: FormState = { error: null };
