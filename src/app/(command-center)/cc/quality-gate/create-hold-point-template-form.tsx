'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createHoldPointTemplateAction } from '@/modules/quality-gate';
import { Label, Input, Button } from '@/core/ui';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

export function CreateHoldPointTemplateForm() {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await createHoldPointTemplateAction({
      workType: String(formData.get('workType') ?? '').trim(),
      name: String(formData.get('name') ?? '').trim(),
      description: String(formData.get('description') ?? '').trim() || undefined,
    });

    if (!result.ok) return { error: result.error.message };
    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div>
        <Label htmlFor="workType">Jenis pekerjaan</Label>
        <Input id="workType" name="workType" required placeholder="mis. waterproofing" className="w-48" />
      </div>
      <div>
        <Label htmlFor="hptName">Nama hold point</Label>
        <Input id="hptName" name="name" required placeholder="mis. Flood test" className="w-48" />
      </div>
      <div>
        <Label htmlFor="hptDescription">Keterangan</Label>
        <Input id="hptDescription" name="description" placeholder="opsional" className="w-64" />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? 'Menyimpan...' : 'Tambah'}
      </Button>
      {state.error !== null && (
        <p role="alert" className="w-full text-sm text-[color:var(--color-danger)]">
          {state.error}
        </p>
      )}
    </form>
  );
}
