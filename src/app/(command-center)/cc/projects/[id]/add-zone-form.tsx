'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createZoneAction } from '@/modules/projects';
import { Label, Input, Button } from '@/core/ui';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

export function AddZoneForm({ projectId }: { projectId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await createZoneAction({
      projectId,
      name: String(formData.get('name') ?? ''),
      description: String(formData.get('description') ?? '') || undefined,
    });

    if (!result.ok) {
      return { error: result.error.message };
    }

    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div>
        <Label htmlFor="zoneName">Nama zona</Label>
        <Input id="zoneName" name="name" required placeholder="mis. Lantai 1" />
      </div>
      <div>
        <Label htmlFor="zoneDescription">Keterangan</Label>
        <Input id="zoneDescription" name="description" />
      </div>
      <Button type="submit" disabled={isPending} size="sm">
        {isPending ? 'Menambah...' : 'Tambah zona'}
      </Button>
      {state.error !== null && (
        <p role="alert" className="w-full text-sm text-[color:var(--color-danger)]">
          {state.error}
        </p>
      )}
    </form>
  );
}
