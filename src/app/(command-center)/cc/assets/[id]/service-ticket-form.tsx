'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createServiceTicketAction } from '@/modules/maintenance-engine';

type FormState = { error: string | null };

export function CreateServiceTicketForm({ assetId }: { assetId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await createServiceTicketAction({
      assetId,
      title: String(formData.get('title') ?? ''),
      description: String(formData.get('description') ?? '') || undefined,
    });

    if (!result.ok) {
      return { error: result.error.message };
    }

    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div>
        <label htmlFor="ticketTitle" className="block text-sm font-medium text-slate-700">
          Judul tiket *
        </label>
        <input
          id="ticketTitle"
          name="title"
          required
          placeholder="AC tidak dingin"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="ticketDescription" className="block text-sm font-medium text-slate-700">
          Deskripsi
        </label>
        <input
          id="ticketDescription"
          name="description"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      {state.error !== null && (
        <p role="alert" className="col-span-full text-sm text-red-600">
          {state.error}
        </p>
      )}

      <div className="col-span-full">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {isPending ? 'Membuat...' : 'Buat tiket servis'}
        </button>
      </div>
    </form>
  );
}

const initialState: FormState = { error: null };
