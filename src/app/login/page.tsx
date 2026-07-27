import { redirect } from 'next/navigation';
import { isSignedIn } from '@/core/auth/session';
import { LoginForm } from './login-form';

export const metadata = { title: 'Masuk — Arkavena OS' };

export default async function LoginPage() {
  if (await isSignedIn()) {
    redirect('/');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[color:var(--color-canvas)] px-4">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 text-center">
          <img
            src="/logo.png"
            alt="Arkavena OS"
            className="mx-auto mb-4 h-16 w-16 rounded-[20px] object-cover shadow-[var(--shadow-card)]"
          />
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
