'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { inviteProjectMemberAction, removeProjectMemberAction, type ProjectMember } from '@/modules/projects';
import { Label, Input, Select, Button, StatusBadge } from '@/core/ui';

type FormState = { error: string | null; ok: boolean; temporaryPassword: string | null };
const initialState: FormState = { error: null, ok: false, temporaryPassword: null };

/**
 * The onboarding path for everyone who is not staff. Until this shipped, a
 * client_approver/client_viewer or site_coordinator/mandor could only be
 * created by writing rows directly into the database -- the Client Timeline
 * and SiteFlow were both unreachable for any real person invited through the
 * app (only suppliers had an invite form, on /cc/vendors/[id]).
 */
const ROLE_LABEL_ID: Record<string, string> = {
  site_coordinator: 'Koordinator Lapangan',
  mandor: 'Mandor',
  client_approver: 'Klien (bisa menyetujui)',
  client_viewer: 'Klien (hanya melihat)',
  supplier: 'Supplier',
  subcontractor: 'Subkontraktor',
};

const ROLE_TONE: Record<string, 'neutral' | 'info' | 'success' | 'warning'> = {
  site_coordinator: 'info',
  mandor: 'info',
  client_approver: 'success',
  client_viewer: 'success',
  supplier: 'warning',
  subcontractor: 'warning',
};

const INVITABLE_ROLES = [
  'client_approver',
  'client_viewer',
  'site_coordinator',
  'mandor',
  'subcontractor',
] as const;

export function ProjectMembersPanel({
  projectId,
  members,
  nameByUserId,
}: {
  projectId: string;
  members: ProjectMember[];
  nameByUserId: Record<string, string>;
}) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await inviteProjectMemberAction({
      projectId,
      email: String(formData.get('email') ?? ''),
      fullName: String(formData.get('fullName') ?? ''),
      projectRole: String(formData.get('projectRole') ?? '') as (typeof INVITABLE_ROLES)[number],
    });

    if (!result.ok) {
      return { error: result.error.message, ok: false, temporaryPassword: null };
    }

    router.refresh();
    return { error: null, ok: true, temporaryPassword: result.data.temporaryPassword };
  }, initialState);

  return (
    <div className="space-y-4">
      {members.length === 0 ? (
        <p className="text-sm text-[color:var(--color-ink-tertiary)]">
          Belum ada anggota. Undang klien agar mereka bisa membuka Portal Klien, atau mandor agar bisa memakai
          SiteFlow.
        </p>
      ) : (
        <ul className="divide-y divide-[color:var(--color-hairline)]">
          {members.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-medium text-[color:var(--color-ink)]">
                  {nameByUserId[member.user_id] ?? member.user_id}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge tone={ROLE_TONE[member.project_role] ?? 'neutral'}>
                  {ROLE_LABEL_ID[member.project_role] ?? member.project_role}
                </StatusBadge>
                <RemoveMemberButton memberId={member.id} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="grid grid-cols-1 gap-4 border-t border-dashed border-[color:var(--color-hairline)] pt-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="member-fullName">Nama *</Label>
          <Input id="member-fullName" name="fullName" required />
        </div>
        <div>
          <Label htmlFor="member-email">Email *</Label>
          <Input id="member-email" name="email" type="email" required />
        </div>
        <div>
          <Label htmlFor="member-projectRole">Peran *</Label>
          <Select id="member-projectRole" name="projectRole" required defaultValue="client_approver">
            {INVITABLE_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABEL_ID[role]}
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
                Berhasil diundang. Kata sandi awal (sampaikan langsung ke orangnya, tidak dikirim lewat email):
              </p>
              <p className="mt-1 font-mono text-base font-semibold text-[color:var(--color-success)]">
                {state.temporaryPassword}
              </p>
            </div>
          )}
          {state.ok && state.temporaryPassword === null && (
            <p className="text-sm text-[color:var(--color-success)]">
              Orang ini sudah punya akun sebelumnya, langsung ditambahkan ke proyek.
            </p>
          )}
          <div className="mt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Mengundang...' : 'Undang ke proyek'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function RemoveMemberButton({ memberId }: { memberId: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(async () => {
    const result = await removeProjectMemberAction({ id: memberId });
    if (!result.ok) return { error: result.error.message };
    router.refresh();
    return { error: null };
  }, { error: null } as { error: string | null });

  return (
    <form action={formAction}>
      <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
        {isPending ? '...' : 'Keluarkan'}
      </Button>
      {state.error !== null && (
        <span role="alert" className="ml-2 text-xs text-[color:var(--color-danger)]">
          {state.error}
        </span>
      )}
    </form>
  );
}
