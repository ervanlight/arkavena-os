'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { overrideOpenWorkPackageAction } from '@/modules/cash-gate';
import { Label, Select, Textarea, Button } from '@/core/ui';

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
      <p className="text-xs text-[color:var(--color-ink-tertiary)]">
        Membuka paket kerja meski Cash Gate merah/terlambat. Alasan wajib diisi dan tercatat di audit log.
      </p>
      <div>
        <Label htmlFor="overrideWorkPackageId">Paket kerja</Label>
        <Select id="overrideWorkPackageId" name="workPackageId" required>
          {workPackages.map((wp) => (
            <option key={wp.id} value={wp.id}>
              {wp.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="overrideReason">Alasan</Label>
        <Textarea
          id="overrideReason"
          name="reason"
          required
          rows={2}
          placeholder="mis. Termin sudah cair, bukti transfer menyusul"
        />
      </div>
      <Button type="submit" variant="destructive" size="sm" disabled={isPending}>
        {isPending ? 'Mengirim override...' : 'Override & buka paket kerja'}
      </Button>
      {state.error !== null && (
        <p role="alert" className="text-sm text-[color:var(--color-danger)]">
          {state.error}
        </p>
      )}
    </form>
  );
}
