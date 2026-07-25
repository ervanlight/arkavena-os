'use client';

import { useActionState } from 'react';
import { createChangeOrderAction } from '@/modules/scope-variation';
import { Button, Input, Label, Textarea } from '@/core/ui';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

export function CreateVariationForm({ projectId }: { projectId: string }) {
  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await createChangeOrderAction({
      projectId,
      title: String(formData.get('title') ?? ''),
      description: String(formData.get('description') ?? '') || undefined,
    });

    if (!result.ok) {
      return { error: result.error.message };
    }

    // Hard navigation, not router.push -- see cc/leads/new/lead-form.tsx's
    // own comment for the full story (a genuine, previously-undiscovered
    // Next.js quirk, not specific to this form).
    window.location.href = `/cc/projects/${projectId}/variations/${result.data.id}`;
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <Label htmlFor="variationTitle">Judul</Label>
        <Input id="variationTitle" name="title" required placeholder="mis. Tambah kamar mandi lantai 2" />
      </div>
      <div>
        <Label htmlFor="variationDescription">Keterangan</Label>
        <Textarea
          id="variationDescription"
          name="description"
          rows={2}
          placeholder="Detail permintaan perubahan dari klien"
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Menyimpan...' : 'Buat draft variation'}
      </Button>
      {state.error !== null && (
        <p role="alert" className="text-sm text-[color:var(--color-danger)]">
          {state.error}
        </p>
      )}
    </form>
  );
}
