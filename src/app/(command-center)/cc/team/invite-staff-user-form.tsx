'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { inviteStaffUserAction } from '@/core/auth/invite-staff-user';

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
        <label htmlFor="fullName" className="block text-sm font-medium text-slate-700">
          Nama *
        </label>
        <input
          id="fullName"
          name="fullName"
          required
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          Email *
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="orgRole" className="block text-sm font-medium text-slate-700">
          Peran *
        </label>
        <select
          id="orgRole"
          name="orgRole"
          required
          defaultValue=""
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="" disabled>
            -- Pilih peran --
          </option>
          {ROLE_OPTIONS.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-end">
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {isPending ? 'Mengundang...' : 'Undang'}
        </button>
      </div>

      <div className="sm:col-span-4">
        {state.error !== null && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )}
        {state.ok && state.temporaryPassword !== null && (
          <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm">
            <p className="text-emerald-800">
              Staf berhasil diundang. Kata sandi awal (sampaikan secara langsung, tidak dikirim lewat email):
            </p>
            <p className="mt-1 font-mono text-base font-semibold text-emerald-900">{state.temporaryPassword}</p>
          </div>
        )}
        {state.ok && state.temporaryPassword === null && (
          <p className="text-sm text-emerald-600">Email ini sudah terdaftar di organisasi Anda.</p>
        )}
      </div>
    </form>
  );
}
