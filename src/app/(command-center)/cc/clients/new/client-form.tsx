'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientAction } from '@/modules/crm';

type FormState = { error: string | null };

/**
 * safeAction-wrapped actions take a plain object matching their Zod schema,
 * not FormData -- so this reads the form fields into an object itself rather
 * than passing the FormData straight through, unlike the login form
 * (which is a hand-written action reading FormData.get() directly).
 */
export function NewClientForm() {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await createClientAction({
      name: String(formData.get('name') ?? ''),
      contactName: String(formData.get('contactName') ?? '') || undefined,
      email: String(formData.get('email') ?? ''),
      phone: String(formData.get('phone') ?? '') || undefined,
      address: String(formData.get('address') ?? '') || undefined,
    });

    if (!result.ok) {
      return { error: result.error.message };
    }

    router.push('/cc/clients');
    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="max-w-lg space-y-4 rounded-lg bg-white p-6 shadow-sm">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-slate-700">
          Nama klien *
        </label>
        <input
          id="name"
          name="name"
          required
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="contactName" className="block text-sm font-medium text-slate-700">
          Nama kontak
        </label>
        <input
          id="contactName"
          name="contactName"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-slate-700">
          Telepon
        </label>
        <input
          id="phone"
          name="phone"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div>
        <label htmlFor="address" className="block text-sm font-medium text-slate-700">
          Alamat
        </label>
        <textarea
          id="address"
          name="address"
          rows={2}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
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
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {isPending ? 'Menyimpan...' : 'Simpan klien'}
      </button>
    </form>
  );
}

const initialState: FormState = { error: null };
