'use client';

import { useActionState } from 'react';
import { requestMagicLink } from '@/core/auth/magic-link';

type FormState = { status: 'idle' | 'sent'; email: string; error: string | null };

const initialState: FormState = { status: 'idle', email: '', error: null };

/**
 * The only sign-in form in the system (owner decision D4). One email field,
 * no password field, because there is no password anywhere to check.
 */
export function LoginForm() {
  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await requestMagicLink(formData);
    const email = String(formData.get('email') ?? '');

    if (!result.ok) {
      return { status: 'idle' as const, email, error: result.error.message };
    }
    return { status: 'sent' as const, email: result.data.email, error: null };
  }, initialState);

  if (state.status === 'sent') {
    return (
      <div role="status" className="space-y-2 text-center">
        <p className="text-lg font-medium text-slate-900">Periksa email Anda</p>
        <p className="text-sm text-slate-600">
          Kami mengirim tautan masuk ke <span className="font-medium">{state.email}</span>. Buka email
          tersebut untuk melanjutkan.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          Alamat email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={state.email}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          placeholder="nama@perusahaan.com"
        />
      </div>

      {state.error !== null && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {isPending ? 'Mengirim...' : 'Kirim tautan masuk'}
      </button>

      <p className="text-center text-xs text-slate-500">
        Tidak perlu kata sandi. Kami mengirim tautan ke email Anda.
      </p>
    </form>
  );
}
