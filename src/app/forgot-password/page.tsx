import { ForgotPasswordForm } from './forgot-password-form';

export const metadata = { title: 'Lupa Kata Sandi — BuildTrust OS' };

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-slate-900">Lupa kata sandi</h1>
          <p className="mt-1 text-sm text-slate-600">Masukkan email Anda untuk menerima tautan atur ulang.</p>
        </div>
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
