'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createWorkPackageAction } from '@/modules/projects';

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
        <label htmlFor="workPackageName" className="block text-xs font-medium text-slate-700">
          Nama paket kerja
        </label>
        <input
          id="workPackageName"
          name="name"
          required
          placeholder="mis. Pemasangan kamar mandi lantai 2"
          className="mt-1 w-64 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {isPending ? 'Membuka...' : 'Buka paket kerja'}
      </button>
      {state.error !== null && (
        <p role="alert" className="w-full text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
