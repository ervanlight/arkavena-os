'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { inviteProjectMemberAction } from '@/modules/projects';
import { Label, Input, Select, Button, TemporaryPasswordModal } from '@/core/ui';

type Project = { id: string; name: string };

type ModalData = { name: string; email: string; password: string } | null;

type FormState = { error: string | null; ok: boolean };
const initial: FormState = { error: null, ok: false };

const ROLE_OPTIONS = [
  { value: 'subcontractor', label: 'Subkontraktor — Akses RAB & Proyek' },
  { value: 'photo_uploader', label: 'Foto Uploader — Upload foto lapangan saja' },
] as const;

interface Props {
  projects: Project[];
}

export function InviteSubkonForm({ projects }: Props) {
  const router = useRouter();
  const [modalData, setModalData] = useState<ModalData>(null);

  const [state, formAction, isPending] = useActionState(
    async (_prev: FormState, formData: FormData) => {
      const result = await inviteProjectMemberAction({
        projectId: String(formData.get('projectId') ?? ''),
        email: String(formData.get('email') ?? ''),
        fullName: String(formData.get('fullName') ?? ''),
        projectRole: String(formData.get('projectRole') ?? '') as 'subcontractor' | 'photo_uploader',
      });

      if (!result.ok) return { error: result.error.message, ok: false };

      if (result.data.temporaryPassword) {
        setModalData({
          name: String(formData.get('fullName') ?? ''),
          email: String(formData.get('email') ?? ''),
          password: result.data.temporaryPassword,
        });
      }

      router.refresh();
      return { error: null, ok: true };
    },
    initial,
  );

  return (
    <>
      {modalData && (
        <TemporaryPasswordModal
          name={modalData.name}
          email={modalData.email}
          password={modalData.password}
          onClose={() => setModalData(null)}
        />
      )}

      <form action={formAction} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="sk-fullName">Nama Lengkap *</Label>
            <Input id="sk-fullName" name="fullName" placeholder="Budi Santoso" required />
          </div>
          <div>
            <Label htmlFor="sk-email">Email *</Label>
            <Input id="sk-email" name="email" type="email" placeholder="budi@subkon.com" required />
          </div>
          <div>
            <Label htmlFor="sk-projectId">Proyek *</Label>
            <Select id="sk-projectId" name="projectId" required defaultValue="">
              <option value="" disabled>— Pilih proyek —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="sk-projectRole">Peran *</Label>
            <Select id="sk-projectRole" name="projectRole" required defaultValue="">
              <option value="" disabled>— Pilih peran —</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Membuat akun...' : 'Buat Akun & Undang'}
          </Button>
          {state.error && (
            <p role="alert" className="text-sm text-[color:var(--color-danger)]">{state.error}</p>
          )}
        </div>
      </form>
    </>
  );
}
