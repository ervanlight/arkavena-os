import { redirect } from 'next/navigation';
import { isSignedIn } from '@/core/auth/session';
import { LoginForm } from './login-form';

export const metadata = { title: 'Masuk — BuildTrust OS' };

export default async function LoginPage() {
  if (await isSignedIn()) {
    redirect('/');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-slate-900">BuildTrust OS</h1>
          <p className="mt-1 text-sm text-slate-600">Masuk dengan email kerja Anda</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
