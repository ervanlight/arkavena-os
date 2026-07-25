'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createWorkPackageAction } from '@/modules/projects';
import { Button, Input, Label } from '@/core/ui';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

/**
 * Creates the work package field teams actually see -- only reachable from
 * this page while the change order is approved_funded (page.tsx's own
 * guard), and trg_work_packages_guard_change_order_funded (ADR 0012) is the
 * database-layer backstop either way.
 */
export function OpenWorkPackageForm({ projectId, changeOrderId }: { projectId: string; changeOrderId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await createWorkPackageAction({
      projectId,
      changeOrderId,
      name: String(formData.get('name') ?? ''),
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
        <Label htmlFor="workPackageName">Nama paket kerja</Label>
        <Input
          id="workPackageName"
          name="name"
          required
          placeholder="mis. Pemasangan kamar mandi lantai 2"
          className="w-64"
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Membuka...' : 'Buka paket kerja'}
      </Button>
      {state.error !== null && (
        <p role="alert" className="w-full text-sm text-[color:var(--color-danger)]">
          {state.error}
        </p>
      )}
    </form>
  );
}
