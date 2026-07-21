'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { overrideOpenWorkPackageAction } from '@/modules/cash-gate';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

type BlockedWorkPackage = { id: string; name: string };

/**
 * Owner-only override: opens a work package despite a red/overdue Cash Gate.
 * Only rendered when the signed-in user is an owner (cosmetic layer,
 * page.tsx checks roleCan) -- requirePermission() and
 * trg_cash_gate_overrides_guard_owner_only both refuse anyone else anyway.
 */
export function OverrideForm({ workPackages }: { workPackages: readonly BlockedWorkPackage[] }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await overrideOpenWorkPackageAction({
      workPackageId: String(formData.get('workPackageId') ?? ''),
      reason: String(formData.get('reason') ?? ''),
    });

    if (!result.ok) {
      return { error: result.error.message };
    }

    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-xs text-slate-500">
        Membuka paket kerja meski Cash Gate merah/terlambat. Alasan wajib diisi dan tercatat di audit log.
      </p>
      <div>
        <label htmlFor="overrideWorkPackageId" className="block text-xs font-medium text-slate-700">
          Paket kerja
        </label>
        <select
          id="overrideWorkPackageId"
          name="workPackageId"
          required
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          {workPackages.map((wp) => (
            <option key={wp.id} value={wp.id}>
              {wp.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="overrideReason" className="block text-xs font-medium text-slate-700">
          Alasan
        </label>
        <textarea
          id="overrideReason"
          name="reason"
          required
          rows={2}
          placeholder="mis. Termin sudah cair, bukti transfer menyusul"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
      >
        {isPending ? 'Mengirim override...' : 'Override & buka paket kerja'}
      </button>
      {state.error !== null && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
