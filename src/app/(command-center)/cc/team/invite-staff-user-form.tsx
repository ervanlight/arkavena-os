'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { inviteStaffUserAction } from '@/core/auth/invite-staff-user';
import { Label, Input, Select, Button } from '@/core/ui';

type FormState = { error: string | null; ok: boolean; temporaryPassword: string | null };
const initialState: FormState = { error: null, ok: false, temporaryPassword: null };

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'technical_director', label: 'Technical Director' },
  { value: 'finance', label: 'Finance' },
  { value: 'qs', label: 'QS' },
  { value: 'procurement', label: 'Procurement' },
] as const;

export function InviteStaffUserForm() {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await inviteStaffUserAction({
      email: String(formData.get('email') ?? ''),
      fullName: String(formData.get('fullName') ?? ''),
      orgRole: String(formData.get('orgRole') ?? '') as (typeof ROLE_OPTIONS)[number]['value'],
    });

    if (!result.ok) {
      return { error: result.error.message, ok: false, temporaryPassword: null };
    }

    router.refresh();
    return { error: null, ok: true, temporaryPassword: result.data.temporaryPassword };
  }, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-4">
      <div>
        <Label htmlFor="fullName">Nama *</Label>
        <Input id="fullName" name="fullName" required />
      </div>
      <div>
        <Label htmlFor="email">Email *</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div>
        <Label htmlFor="orgRole">Peran *</Label>
        <Select id="orgRole" name="orgRole" required defaultValue="">
          <option value="" disabled>
            -- Pilih peran --
          </option>
          {ROLE_OPTIONS.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-end">
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? 'Mengundang...' : 'Undang'}
        </Button>
      </div>

      <div className="sm:col-span-4">
        {state.error !== null && (
          <p role="alert" className="text-sm text-[color:var(--color-danger)]">
            {state.error}
          </p>
        )}
        {state.ok && state.temporaryPassword !== null && (
          <div
            role="status"
            className="rounded-[var(--radius-control)] border border-[color:var(--color-success)]/30 bg-[color:var(--color-success)]/12 p-3 text-sm"
          >
            <p className="text-[color:var(--color-success)]">
              Staf berhasil diundang. Kata sandi awal (sampaikan secara langsung, tidak dikirim lewat email):
            </p>
            <p className="mt-1 font-mono text-base font-semibold text-[color:var(--color-success)]">
              {state.temporaryPassword}
            </p>
          </div>
        )}
        {state.ok && state.temporaryPassword === null && (
          <p className="text-sm text-[color:var(--color-success)]">Email ini sudah terdaftar di organisasi Anda.</p>
        )}
      </div>
    </form>
  );
}
