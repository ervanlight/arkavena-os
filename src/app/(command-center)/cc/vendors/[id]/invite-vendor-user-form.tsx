'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { inviteVendorUserAction } from '@/modules/procurement';
import type { Project } from '@/modules/projects';
import { Label, Input, Select, Button } from '@/core/ui';

type FormState = { error: string | null; ok: boolean; temporaryPassword: string | null };
const initialState: FormState = { error: null, ok: false, temporaryPassword: null };

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
      return { error: result.error.message, ok: false, temporaryPassword: null };
    }

    router.refresh();
    return { error: null, ok: true, temporaryPassword: result.data.temporaryPassword };
  }, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div>
        <Label htmlFor="fullName">Nama kontak *</Label>
        <Input id="fullName" name="fullName" required />
      </div>
      <div>
        <Label htmlFor="email">Email *</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div>
        <Label htmlFor="projectId">Proyek (opsional)</Label>
        <Select id="projectId" name="projectId">
          <option value="">-- Tidak ditambahkan ke proyek --</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="sm:col-span-3">
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
              Kontak vendor berhasil diundang. Kata sandi awal (sampaikan ke kontak ini secara langsung, tidak
              dikirim lewat email):
            </p>
            <p className="mt-1 font-mono text-base font-semibold text-[color:var(--color-success)]">
              {state.temporaryPassword}
            </p>
          </div>
        )}
        {state.ok && state.temporaryPassword === null && (
          <p className="text-sm text-[color:var(--color-success)]">
            Kontak vendor sudah terdaftar sebelumnya, ditambahkan ke proyek.
          </p>
        )}
        <div className="mt-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Mengundang...' : 'Undang ke Partner Desk'}
          </Button>
        </div>
      </div>
    </form>
  );
}
