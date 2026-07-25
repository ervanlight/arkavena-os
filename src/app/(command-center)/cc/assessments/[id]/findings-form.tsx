'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateAssessmentFindingsAction } from '@/modules/assessment';
import { generateAssessmentScopeDraftAction } from '@/modules/ai-scribe';
import { Label, Textarea, Button } from '@/core/ui';

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
  const [recommendedScopeValue, setRecommendedScopeValue] = useState(recommendedScope ?? '');
  const [assist, setAssist] = useState<AssistState>({ status: 'idle' });

  /** Draft only -- fills the same textarea the human still reviews and saves via the form below (ADR 0020 SS2). */
  async function handleAssist() {
    setAssist({ status: 'loading' });
    const result = await generateAssessmentScopeDraftAction({ assessmentId });

    if (!result.ok) {
      setAssist({ status: 'error', message: result.error.message });
      return;
    }

    setRecommendedScopeValue(result.data.suggestedScope);
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
        <Label htmlFor="siteConditions">Kondisi lokasi</Label>
        <Textarea
          id="siteConditions"
          name="siteConditions"
          rows={3}
          disabled={disabled}
          defaultValue={siteConditions ?? ''}
        />
      </div>
      <div>
        <Label htmlFor="recommendedScope">Ruang lingkup direkomendasikan</Label>
        <Textarea
          id="recommendedScope"
          name="recommendedScope"
          rows={3}
          disabled={disabled}
          value={recommendedScopeValue}
          onChange={(e) => setRecommendedScopeValue(e.target.value)}
        />
        {!disabled && (
          <div className="mt-1">
            <Button type="button" variant="secondary" size="sm" onClick={handleAssist} disabled={assist.status === 'loading'}>
              {assist.status === 'loading' ? 'Meminta saran...' : 'Saran otomatis (AI)'}
            </Button>
            {assist.status === 'suggested' && (
              <p className="mt-1 text-sm text-[color:var(--color-ink-secondary)]">
                Draf terisi otomatis -- periksa dan sunting sebelum menyimpan.
              </p>
            )}
            {assist.status === 'error' && (
              <p role="alert" className="mt-1 text-sm text-[color:var(--color-danger)]">
                {assist.message}
              </p>
            )}
          </div>
        )}
      </div>
      <div>
        <Label htmlFor="notes">Catatan</Label>
        <Textarea id="notes" name="notes" rows={2} disabled={disabled} defaultValue={notes ?? ''} />
      </div>

      {state.error !== null && (
        <p role="alert" className="text-sm text-[color:var(--color-danger)]">
          {state.error}
        </p>
      )}

      {!disabled && (
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Menyimpan...' : 'Simpan temuan'}
        </Button>
      )}
    </form>
  );
}

const initialState: FormState = { error: null };
