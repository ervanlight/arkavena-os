'use client';

import { useState } from 'react';
import { Copy, Check, X } from 'lucide-react';

interface TemporaryPasswordModalProps {
  name: string;
  email: string;
  password: string;
  onClose: () => void;
}

export function TemporaryPasswordModal({ name, email, password, onClose }: TemporaryPasswordModalProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-[color:var(--color-surface)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[color:var(--color-hairline)] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-500/15">
              <Check className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-[color:var(--color-ink)]">Akun berhasil dibuat</h3>
              <p className="text-xs text-[color:var(--color-ink-secondary)]">{name} · {email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--color-ink-tertiary)] hover:bg-[color:var(--color-surface-secondary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-[color:var(--color-ink-secondary)] leading-relaxed">
            Sampaikan password sementara ini kepada pengguna <strong className="text-[color:var(--color-ink)]">{name}</strong> secara langsung (WhatsApp, telepon, atau tatap muka). Jangan kirim lewat email.
          </p>

          {/* Password display */}
          <div className="relative rounded-xl border-2 border-dashed border-[color:var(--color-accent)]/40 bg-[color:var(--color-accent)]/5 px-5 py-4">
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-[color:var(--color-ink-tertiary)]">Password Sementara</p>
            <p className="font-mono text-2xl font-bold tracking-widest text-[color:var(--color-ink)]">{password}</p>
            <button
              onClick={handleCopy}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--color-surface)] text-[color:var(--color-ink-secondary)] shadow-sm hover:text-[color:var(--color-accent)] transition-colors"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
            <p className="text-xs text-amber-800 leading-relaxed">
              ⚠️ Password ini <strong>hanya tampil sekali</strong>. Pengguna harus mengganti password mereka saat pertama kali login. Setelah modal ini ditutup, password tidak dapat ditampilkan kembali.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[color:var(--color-hairline)] px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-[var(--radius-control)] bg-[color:var(--color-ink)] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            Saya sudah mencatat, tutup
          </button>
        </div>
      </div>
    </div>
  );
}
