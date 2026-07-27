import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/core/auth/session';
import { LoginForm } from './login-form';
import { Logo } from '@/core/ui';

export const metadata = { title: 'Masuk — Arkavena OS' };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect(user.orgRole ? '/cc' : '/site');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[color:var(--color-canvas)] px-4">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 text-center">
          <Logo size={64} className="mx-auto mb-4" />
          <h1 className="text-[22px] font-bold tracking-tight text-[color:var(--color-ink)]">Arkavena OS</h1>
          <p className="mt-1 text-[15px] text-[color:var(--color-ink-secondary)]">Masuk dengan email kerja Anda</p>
        </div>
        <div className="rounded-[var(--radius-sheet)] bg-[color:var(--color-surface)] p-7 shadow-[var(--shadow-sheet)]">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
