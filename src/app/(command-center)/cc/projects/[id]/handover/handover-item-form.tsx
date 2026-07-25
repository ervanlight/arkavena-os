'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createHandoverItemAction } from '@/modules/maintenance-engine';
import { Label, Input, Button } from '@/core/ui';

type FormState = { error: string | null };

export function CreateHandoverItemForm({ projectId }: { projectId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await createHandoverItemAction({
      projectId,
      itemType: String(formData.get('itemType') ?? ''),
      description: String(formData.get('description') ?? '') || undefined,
      handedOverTo: String(formData.get('handedOverTo') ?? '') || undefined,
    });

    if (!result.ok) {
      return { error: result.error.message };
    }

    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div>
        <Label htmlFor="itemType">Jenis item *</Label>
        <Input id="itemType" name="itemType" required placeholder="key, as_built_drawing, ac_unit, ..." />
      </div>
      <div>
        <Label htmlFor="description">Deskripsi</Label>
        <Input id="description" name="description" />
      </div>
      <div>
        <Label htmlFor="handedOverTo">Diserahkan kepada</Label>
        <Input id="handedOverTo" name="handedOverTo" />
      </div>

      {state.error !== null && (
        <p role="alert" className="col-span-full text-sm text-[color:var(--color-danger)]">
          {state.error}
        </p>
      )}

      <div className="col-span-full">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Menyimpan...' : 'Tambah item handover'}
        </Button>
      </div>
    </form>
  );
}

const initialState: FormState = { error: null };
