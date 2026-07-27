'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Camera,
  ShieldCheck,
  Eye,
  Key,
  Copy,
  Check,
  Trash2,
  Lock,
  X,
  UserX,
  MessageSquare,
} from 'lucide-react';
import { StatusBadge } from '@/core/ui';
import {
  revokeProjectAccessAction,
  resetUserPasswordAction,
  deleteUserAccountAction,
  type ExternalUserWithProjects,
} from '@/modules/access-management/actions';

const ROLE_CONFIG: Record<
  string,
  {
    label: string;
    icon: React.ElementType;
    avatarClass: string;
    badgeClass: string;
  }
> = {
  subcontractor: {
    label: 'Subkontraktor',
    icon: Users,
    avatarClass: 'bg-violet-100 text-violet-700',
    badgeClass: 'bg-violet-100 text-violet-700',
  },
  photo_uploader: {
    label: 'Pengawas',
    icon: Camera,
    avatarClass: 'bg-orange-100 text-orange-700',
    badgeClass: 'bg-orange-100 text-orange-700',
  },
  client_approver: {
    label: 'Klien Approver',
    icon: ShieldCheck,
    avatarClass: 'bg-blue-100 text-blue-700',
    badgeClass: 'bg-blue-100 text-blue-700',
  },
  client_viewer: {
    label: 'Klien Viewer',
    icon: Eye,
    avatarClass: 'bg-slate-100 text-slate-600',
    badgeClass: 'bg-slate-100 text-slate-600',
  },
};

const DEFAULT_ROLE_CFG = ROLE_CONFIG.subcontractor!;

const STATUS_TONE: Record<string, 'success' | 'warning' | 'neutral'> = {
  active: 'success',
  invited: 'warning',
};

interface UserAccountCardProps {
  user: ExternalUserWithProjects;
}

export function UserAccountCard({ user }: UserAccountCardProps) {
  const router = useRouter();
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [copiedWa, setCopiedWa] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resetPending, setResetPending] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePending, setDeletePending] = useState(false);

  const [revokingMemberId, setRevokingMemberId] = useState<string | null>(null);
  const [revokePending, setRevokePending] = useState(false);

  const primaryRole = user.projects[0]?.role ?? 'subcontractor';
  const cfg = ROLE_CONFIG[primaryRole] ?? DEFAULT_ROLE_CFG;

  async function handleCopyEmail() {
    await navigator.clipboard.writeText(user.email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  }

  async function handleCopyPassword() {
    if (!user.managedPassword) return;
    await navigator.clipboard.writeText(user.managedPassword);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  }

  async function handleCopyWaFormat() {
    const waText = `Halo ${user.fullName}, berikut kredensial login Anda ke Arkavena OS:\n\nURL Login: ${window.location.origin}\nID / Username: ${user.email}\nPassword: ${user.managedPassword ?? '(gunakan password Anda)'}\n\nSilakan simpan informasi login ini.`;
    await navigator.clipboard.writeText(waText);
    setCopiedWa(true);
    setTimeout(() => setCopiedWa(false), 2000);
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword.trim()) return;
    setResetPending(true);
    setResetMsg(null);
    const res = await resetUserPasswordAction({ userId: user.userId, newPassword: newPassword.trim() });
    setResetPending(false);
    if (res.ok) {
      setResetMsg('Password berhasil diperbarui.');
      setTimeout(() => {
        setShowPasswordModal(false);
        setResetMsg(null);
        setNewPassword('');
        router.refresh();
      }, 1000);
    } else {
      setResetMsg(`Gagal: ${res.error.message}`);
    }
  }

  async function handleDeleteAccount() {
    setDeletePending(true);
    const res = await deleteUserAccountAction({ userId: user.userId });
    setDeletePending(false);
    if (res.ok) {
      setConfirmDelete(false);
      router.refresh();
    }
  }

  async function handleRevokeProject(memberId: string) {
    setRevokePending(true);
    const res = await revokeProjectAccessAction({ memberId });
    setRevokePending(false);
    if (res.ok) {
      setRevokingMemberId(null);
      router.refresh();
    }
  }

  return (
    <li className="py-4 first:pt-0 last:pb-0 space-y-3">
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${cfg.avatarClass}`}>
            {user.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[15px] font-semibold text-[color:var(--color-ink)] truncate">{user.fullName}</p>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cfg.badgeClass}`}>
                {cfg.label}
              </span>
            </div>
            
            {/* ID / Email line */}
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[color:var(--color-ink-secondary)]">
              <span className="font-mono bg-[color:var(--color-surface-secondary)] px-1.5 py-0.5 rounded text-[12px] text-[color:var(--color-ink)]">
                {user.email}
              </span>
              <button
                onClick={handleCopyEmail}
                title="Salin ID Login"
                className="text-[color:var(--color-ink-tertiary)] hover:text-[color:var(--color-accent)] transition-colors"
              >
                {copiedEmail ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <StatusBadge tone={STATUS_TONE[user.status] ?? 'neutral'}>
            {user.status === 'invited' ? 'Belum login' : 'Aktif'}
          </StatusBadge>

          {/* Reset password trigger */}
          <button
            onClick={() => setShowPasswordModal(true)}
            title="Ubah Password"
            className="flex items-center gap-1 rounded-lg border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2.5 py-1 text-xs font-medium text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-secondary)] transition-colors"
          >
            <Key className="h-3.5 w-3.5 text-[color:var(--color-ink-tertiary)]" />
            <span>Reset Password</span>
          </button>

          {/* Delete account trigger */}
          {confirmDelete ? (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 px-2 py-1 rounded-lg">
              <span className="text-xs text-red-600 font-medium">Hapus total?</span>
              <button
                onClick={handleDeleteAccount}
                disabled={deletePending}
                className="rounded bg-red-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletePending ? '...' : 'Ya'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Batal
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              title="Hapus Akun Pengguna Ini"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <UserX className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Password & Copy WA Banner */}
      <div className="ml-13 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
        <div className="flex items-center gap-2">
          <Lock className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-slate-500 font-medium">Password:</span>
          {user.managedPassword ? (
            <span className="font-mono font-bold text-slate-900 tracking-wider text-sm">
              {user.managedPassword}
            </span>
          ) : (
            <span className="text-slate-400 italic">Belum diset / Password kustom</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {user.managedPassword && (
            <button
              onClick={handleCopyPassword}
              className="flex items-center gap-1 rounded bg-white px-2 py-1 text-slate-700 border border-slate-200 hover:bg-slate-100 font-medium shadow-sm transition-colors"
            >
              {copiedPassword ? (
                <>
                  <Check className="h-3 w-3 text-green-600" />
                  <span className="text-green-600">Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 text-slate-500" />
                  <span>Salin Password</span>
                </>
              )}
            </button>
          )}

          {/* Salin Format WA button */}
          <button
            onClick={handleCopyWaFormat}
            className="flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-medium shadow-sm transition-colors"
          >
            {copiedWa ? (
              <>
                <Check className="h-3 w-3 text-emerald-600" />
                <span className="text-emerald-600">Format WA Tersalin!</span>
              </>
            ) : (
              <>
                <MessageSquare className="h-3 w-3 text-emerald-600" />
                <span>Salin Format WA</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Projects */}
      {user.projects.length > 0 && (
        <div className="ml-13 space-y-1">
          <p className="text-[11px] font-medium text-[color:var(--color-ink-tertiary)] uppercase tracking-wider">
            Akses Proyek ({user.projects.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {user.projects.map((proj) => {
              const projCfg = ROLE_CONFIG[proj.role] ?? DEFAULT_ROLE_CFG;
              const ProjIcon = projCfg.icon;
              const isRevoking = revokingMemberId === proj.memberId;

              return (
                <div
                  key={proj.memberId}
                  className="flex items-center gap-1.5 rounded-lg border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-secondary)] pl-2.5 pr-1 py-1"
                >
                  <ProjIcon className="h-3 w-3 text-[color:var(--color-ink-tertiary)]" />
                  <span className="text-xs font-medium text-[color:var(--color-ink)]">{proj.projectName}</span>
                  
                  {isRevoking ? (
                    <div className="flex items-center gap-1 ml-1 bg-red-50 px-1 py-0.5 rounded border border-red-200">
                      <span className="text-[10px] text-red-600">Cabut?</span>
                      <button
                        onClick={() => handleRevokeProject(proj.memberId)}
                        disabled={revokePending}
                        className="text-[10px] font-bold text-red-600 hover:underline disabled:opacity-50"
                      >
                        Ya
                      </button>
                      <button
                        onClick={() => setRevokingMemberId(null)}
                        className="text-[10px] text-gray-500 hover:text-gray-700"
                      >
                        X
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setRevokingMemberId(proj.memberId)}
                      title="Cabut dari proyek ini"
                      className="ml-1 flex h-5 w-5 items-center justify-center rounded text-[color:var(--color-ink-tertiary)] hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl bg-[color:var(--color-surface)] p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[color:var(--color-hairline)]">
              <h3 className="text-sm font-semibold text-[color:var(--color-ink)]">Reset Password — {user.fullName}</h3>
              <button onClick={() => setShowPasswordModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleResetPassword} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-[color:var(--color-ink-secondary)]">Password Baru *</label>
                <input
                  type="text"
                  required
                  minLength={4}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Contoh: password123"
                  className="mt-1 w-full rounded-lg border border-[color:var(--color-hairline)] bg-[color:var(--color-canvas)] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]"
                />
              </div>

              {resetMsg && (
                <p className={`text-xs font-medium ${resetMsg.startsWith('Gagal') ? 'text-red-600' : 'text-green-600'}`}>
                  {resetMsg}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="rounded-lg border border-[color:var(--color-hairline)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-ink-secondary)] hover:bg-[color:var(--color-surface-secondary)]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={resetPending || !newPassword.trim()}
                  className="rounded-lg bg-[color:var(--color-ink)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {resetPending ? 'Menyimpan...' : 'Simpan Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </li>
  );
}
