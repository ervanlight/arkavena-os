import { ResetPasswordForm } from './reset-password-form';
import { Logo } from '@/core/ui';

export const metadata = { title: 'Atur Ulang Kata Sandi — Arkavena OS' };

/**
 * Reached only after /auth/callback has already exchanged a recovery link's
 * code into a session (ADR 0025 SS3) -- this page itself does not check
 * that; updatePassword's own Supabase call simply fails if no session exists.
 */
export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[color:var(--color-canvas)] px-4">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 text-center">
          <Logo size={56} className="mx-auto mb-4" />
          <h1 className="text-[22px] font-bold tracking-tight text-[color:var(--color-ink)]">Atur kata sandi baru</h1>
        </div>
        <div className="rounded-[var(--radius-sheet)] bg-[color:var(--color-surface)] p-7 shadow-[var(--shadow-sheet)]">
          <ResetPasswordForm />
        </div>
      </div>
    </main>
  );
}
