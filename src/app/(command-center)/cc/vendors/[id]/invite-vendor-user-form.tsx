'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { inviteVendorUserAction } from '@/modules/procurement';
import type { Project } from '@/modules/projects';

type FormState = { error: string | null; ok: boolean };
const initialState: FormState = { error: null, ok: false };

export function InviteVendorUserForm({ vendorId, projects }: { vendorId: string; projects: Project[] }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const projectId = String(formData.get('projectId') ?? '');
    const result = await inviteVendorUserAction({
      vendorId,
      email: String(formData.get('email') ?? ''),
      fullName: String(formData.get('fullName') ?? ''),
      ...(projectId !== '' ? { projectId } : {}),
    });

    if (!result.ok) {
      return { error: result.error.message, ok: false };
    }

    router.refresh();
    return { error: null, ok: true };
  }, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div>
        <label htmlFor="fullName" className="block text-sm font-medium text-slate-700">
          Nama kontak *
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
        <label htmlFor="projectId" className="block text-sm font-medium text-slate-700">
          Proyek (opsional)
        </label>
        <select
          id="projectId"
          name="projectId"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="">-- Tidak ditambahkan ke proyek --</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      <div className="sm:col-span-3">
        {state.error !== null && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )}
        {state.ok && <p className="text-sm text-emerald-600">Kontak vendor berhasil diundang.</p>}
        <button
          type="submit"
          disabled={isPending}
          className="mt-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {isPending ? 'Mengundang...' : 'Undang ke Partner Desk'}
        </button>
      </div>
    </form>
  );
}
