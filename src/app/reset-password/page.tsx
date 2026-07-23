import { ResetPasswordForm } from './reset-password-form';

export const metadata = { title: 'Atur Ulang Kata Sandi — BuildTrust OS' };

/**
 * Reached only after /auth/callback has already exchanged a recovery link's
 * code into a session (ADR 0025 SS3) -- this page itself does not check
 * that; updatePassword's own Supabase call simply fails if no session exists,
 * and the generic error message it returns is enough here (no organisation
 * context exists yet to build anything more specific from).
 */
export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-slate-900">Atur kata sandi baru</h1>
        </div>
        <ResetPasswordForm />
      </div>
    </main>
  );
}
