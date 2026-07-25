'use client';

import { useActionState } from 'react';
import { createEstimateAction } from '@/modules/estimating';
import { Button, Card, Input, Label, Textarea } from '@/core/ui';

type FormState = { error: string | null };

export function NewEstimateForm({ projectId }: { projectId: string }) {
  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await createEstimateAction({
      projectId,
      title: String(formData.get('title') ?? ''),
      notes: String(formData.get('notes') ?? '') || undefined,
    });

    if (!result.ok) {
      return { error: result.error.message };
    }

    // Hard navigation, not router.push -- see NewLeadForm's own comment.
    window.location.href = `/cc/projects/${projectId}/estimates/${result.data.id}`;
    return { error: null };
  }, initialState);

  return (
    <Card className="max-w-lg">
      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="title">Judul *</Label>
          <Input id="title" name="title" required placeholder="Estimasi awal" />
        </div>
        <div>
          <Label htmlFor="notes">Catatan</Label>
          <Textarea id="notes" name="notes" rows={3} />
        </div>

        {state.error !== null && (
          <p role="alert" className="text-sm text-[color:var(--color-danger)]">
            {state.error}
          </p>
        )}

        <Button type="submit" disabled={isPending}>
          {isPending ? 'Menyimpan...' : 'Buat estimasi'}
        </Button>
      </form>
    </Card>
  );
}

const initialState: FormState = { error: null };
