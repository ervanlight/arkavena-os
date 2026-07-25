'use client';

import { useState } from 'react';
import { provisionClientAccountAction } from '@/modules/crm';

export function ClientAccountProvisioner({ clientId, hasEmail }: { clientId: string; hasEmail: boolean }) {
  const [isPending, setIsPending] = useState(false);
  const [result, setResult] = useState<{ type: 'success'; password: string | null } | { type: 'error'; message: string } | null>(null);

  async function handleProvision() {
    setIsPending(true);
    setResult(null);
    try {
      const res = await provisionClientAccountAction({ clientId });
      if (res.ok) {
        setResult({ type: 'success', password: res.data.temporaryPassword });
      } else {
        setResult({ type: 'error', message: res.error.message });
      }
    } catch (e) {
      setResult({ type: 'error', message: 'Terjadi kesalahan internal.' });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div>
      <button 
        onClick={handleProvision} 
        disabled={isPending || !hasEmail}
        title={!hasEmail ? 'Klien harus memiliki email' : ''}
        className="rounded-[8px] bg-[color:var(--color-surface-secondary)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-hover)] disabled:opacity-50"
      >
        {isPending ? 'Memproses...' : 'Buatkan Akun'}
      </button>

      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-[12px] bg-[color:var(--color-surface)] p-6 shadow-xl">
            {result.type === 'error' ? (
              <>
                <h3 className="text-lg font-semibold text-[color:var(--color-danger)]">Gagal</h3>
                <p className="mt-2 text-sm text-[color:var(--color-ink-secondary)]">{result.message}</p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-[color:var(--color-ink)]">Akun Berhasil Disiapkan</h3>
                {result.password ? (
                  <>
                    <p className="mt-2 text-sm text-[color:var(--color-ink-secondary)]">
                      Berikan password sementara ini kepada klien Anda. Mereka wajib menggantinya saat login pertama kali.
                    </p>
                    <div className="mt-4 rounded bg-[color:var(--color-canvas)] p-3 text-center">
                      <span className="font-mono text-lg font-bold tracking-wider text-[color:var(--color-ink)]">
                        {result.password}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-[color:var(--color-ink-secondary)]">
                    Klien ini sudah memiliki akun yang terhubung. (Password tidak diubah demi keamanan).
                  </p>
                )}
              </>
            )}
            <div className="mt-6 flex justify-end">
              <button 
                onClick={() => setResult(null)}
                className="rounded-[8px] bg-[color:var(--color-ink)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--color-ink)]/90"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
