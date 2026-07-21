'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { createSiteAction } from '@/modules/crm';
import type { Client } from '@/modules/crm';
import { createProjectAction } from '@/modules/projects';

type FormState = { error: string | null };
const initialState: FormState = { error: null };

/**
 * Creates a site alongside the project rather than picking an existing one.
 * projects.site_id is not-null (ADR 0007); Fase 1 has no site-management UI
 * of its own yet, so the simplest correct path is creating the site the
 * project needs at the same time, not building a second full CRUD screen for
 * a table nothing else surfaces yet.
 */
export function NewProjectForm({ clients }: { clients: Client[] }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const clientId = String(formData.get('clientId') ?? '');
    const siteName = String(formData.get('siteName') ?? '');
    const siteAddress = String(formData.get('siteAddress') ?? '') || undefined;
    const projectName = String(formData.get('projectName') ?? '');
    const startDate = String(formData.get('startDate') ?? '') || undefined;

    const siteResult = await createSiteAction({ clientId, name: siteName, address: siteAddress });
    if (!siteResult.ok) {
      return { error: siteResult.error.message };
    }

    const projectResult = await createProjectAction({
      clientId,
      siteId: siteResult.data.id,
      name: projectName,
      startDate,
    });
    if (!projectResult.ok) {
      return { error: projectResult.error.message };
    }

    router.push(`/cc/projects/${projectResult.data.id}`);
    router.refresh();
    return { error: null };
  }, initialState);

  return (
    <form action={formAction} className="max-w-lg space-y-4 rounded-lg bg-white p-6 shadow-sm">
      <div>
        <label htmlFor="clientId" className="block text-sm font-medium text-slate-700">
          Klien *
        </label>
        <select
          id="clientId"
          name="clientId"
          required
          defaultValue=""
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="" disabled>
            Pilih klien
          </option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
        {clients.length === 0 && (
          <p className="mt-1 text-xs text-amber-600">Belum ada klien. Tambahkan klien terlebih dahulu.</p>
        )}
      </div>

      <div className="border-t border-slate-100 pt-4">
        <p className="text-sm font-medium text-slate-700">Lokasi proyek</p>
        <div className="mt-2 space-y-3">
          <div>
            <label htmlFor="siteName" className="block text-sm text-slate-600">
              Nama lokasi *
            </label>
            <input
              id="siteName"
              name="siteName"
              required
              placeholder="mis. Rumah Pak Budi — Jl. Merdeka No. 10"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
          <div>
            <label htmlFor="siteAddress" className="block text-sm text-slate-600">
              Alamat
            </label>
            <textarea
              id="siteAddress"
              name="siteAddress"
              rows={2}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <label htmlFor="projectName" className="block text-sm font-medium text-slate-700">
          Nama proyek *
        </label>
        <input
          id="projectName"
          name="projectName"
          required
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      <div>
        <label htmlFor="startDate" className="block text-sm font-medium text-slate-700">
          Tanggal mulai
        </label>
        <input
          id="startDate"
          name="startDate"
          type="date"
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
        {isPending ? 'Menyimpan...' : 'Simpan proyek'}
      </button>
    </form>
  );
}
