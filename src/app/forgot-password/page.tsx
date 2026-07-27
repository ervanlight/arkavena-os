import { ForgotPasswordForm } from './forgot-password-form';
import { Logo } from '@/core/ui';

export const metadata = { title: 'Lupa Kata Sandi — Arkavena OS' };

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[color:var(--color-canvas)] px-4">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 text-center">
          <Logo size={56} className="mx-auto mb-4" />
          <h1 className="text-[22px] font-bold tracking-tight text-[color:var(--color-ink)]">Lupa kata sandi</h1>
          <p className="mt-1 text-[15px] text-[color:var(--color-ink-secondary)]">
            Masukkan email Anda untuk menerima tautan atur ulang.
          </p>
          <div className="mt-3 text-xs bg-orange-50 text-orange-700 p-2 rounded-lg border border-orange-200">
            <strong>Catatan:</strong> Fitur ini hanya untuk Staff Arkavena. Bagi Klien, Subkon, dan Pengawas yang lupa password, silakan hubungi CS/Admin.
          </div>
        </div>
        <div className="rounded-[var(--radius-sheet)] bg-[color:var(--color-surface)] p-7 shadow-[var(--shadow-sheet)]">
          <ForgotPasswordForm />
        </div>
      </div>
    </main>
  );
}
