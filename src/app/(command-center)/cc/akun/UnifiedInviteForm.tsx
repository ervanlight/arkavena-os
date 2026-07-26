'use client';

import { useState, useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { inviteProjectMemberAction } from '@/modules/projects';
import { Label, Input, Select, Button, TemporaryPasswordModal } from '@/core/ui';

type Project = { id: string; name: string };
type ModalData = { name: string; email: string; password: string } | null;
type FormState = { error: string | null; ok: boolean };
const initial: FormState = { error: null, ok: false };

type RoleOption = {
  value: 'subcontractor' | 'photo_uploader' | 'client_approver' | 'client_viewer';
  label: string;
  desc: string;
};

type RoleGroup = {
  group: string;
  options: RoleOption[];
};

const ROLE_OPTIONS: RoleGroup[] = [
  {
    group: 'Subkontraktor',
    options: [
      { value: 'subcontractor', label: 'Subkontraktor', desc: 'Akses Partner Desk, pengajuan RAB, lihat PO' },
      { value: 'photo_uploader', label: 'Pengawas', desc: 'Hanya bisa upload foto lapangan & lihat riwayat upload' },
    ],
  },
  {
    group: 'Klien',
    options: [
      { value: 'client_approver', label: 'Klien Approver', desc: 'Bisa menyetujui proposal, change order & dokumen' },
      { value: 'client_viewer', label: 'Klien Viewer', desc: 'Hanya bisa melihat progres proyek' },
    ],
  },
];

const ALL_ROLES: RoleOption[] = ROLE_OPTIONS.flatMap((g) => g.options);

interface Props {
  projects: Project[];
}

export function UnifiedInviteForm({ projects }: Props) {
  const router = useRouter();
  const [modalData, setModalData] = useState<ModalData>(null);
  const [selectedRole, setSelectedRole] = useState('');

  const roleDesc = ALL_ROLES.find((r) => r.value === selectedRole)?.desc ?? '';

  const [state, formAction, isPending] = useActionState(
    async (_prev: FormState, formData: FormData) => {
      const role = String(formData.get('projectRole') ?? '');
      const result = await inviteProjectMemberAction({
        projectId: String(formData.get('projectId') ?? ''),
        email: String(formData.get('email') ?? ''),
        fullName: String(formData.get('fullName') ?? ''),
        projectRole: role as 'subcontractor' | 'photo_uploader' | 'client_approver' | 'client_viewer',
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

      <form action={formAction} className="space-y-5">
        {/* Row 1: Name + Email */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="inv-fullName">Nama Lengkap *</Label>
            <Input id="inv-fullName" name="fullName" placeholder="Nama pengguna" required />
          </div>
          <div>
            <Label htmlFor="inv-email">Email *</Label>
            <Input id="inv-email" name="email" type="email" placeholder="email@domain.com" required />
          </div>
        </div>

        {/* Row 2: Project + Role */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="inv-projectId">Proyek *</Label>
            {projects.length === 0 ? (
              <p className="mt-1.5 text-sm text-[color:var(--color-danger)]">
                Belum ada proyek — buat proyek terlebih dahulu.
              </p>
            ) : (
              <Select id="inv-projectId" name="projectId" required defaultValue="">
                <option value="" disabled>— Pilih proyek —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            )}
          </div>
          <div>
            <Label htmlFor="inv-projectRole">Tipe Akun *</Label>
            <Select
              id="inv-projectRole"
              name="projectRole"
              required
              defaultValue=""
              onChange={(e) => setSelectedRole(e.target.value)}
            >
              <option value="" disabled>— Pilih tipe —</option>
              {ROLE_OPTIONS.map((group) => (
                <optgroup key={group.group} label={group.group}>
                  {group.options.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </optgroup>
              ))}
            </Select>
            {roleDesc && (
              <p className="mt-1.5 text-xs text-[color:var(--color-ink-secondary)]">{roleDesc}</p>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={isPending || projects.length === 0}>
            {isPending ? 'Membuat akun...' : 'Buat Akun & Undang'}
          </Button>
          {state.error && (
            <p role="alert" className="text-sm text-[color:var(--color-danger)]">{state.error}</p>
          )}
          {state.ok && !modalData && (
            <p className="text-sm text-green-600">Akun berhasil dibuat (email sudah punya akun).</p>
          )}
        </div>
      </form>
    </>
  );
}
