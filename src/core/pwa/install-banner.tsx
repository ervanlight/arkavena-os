'use client';

import { useEffect, useState } from 'react';

const DISMISS_KEY = 'siteflow-install-banner-dismissed';

type Platform = 'ios' | 'android' | 'other';

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

/**
 * A one-time, dismissible nudge to add SiteFlow to the home screen --
 * never a requirement. The app works fully from an ordinary browser tab,
 * including offline (D3's outbox lives at the application layer, not
 * "installed" mode). This exists purely to save a field user from re-tapping
 * a WhatsApp link every single day, per the owner's own explicit request to
 * design for this rather than discover it during field testing.
 *
 * No `beforeinstallprompt` handling: that event only fires on Chrome/
 * Android, and even there, showing the browser's own native install prompt
 * on top of a big-button field UI is more disruptive than a plain
 * instruction line. iOS has no equivalent event at all -- Apple does not
 * expose one -- so both platforms get the same simple instructional
 * banner instead of trying to unify around an API only one of them has.
 */
export function InstallBanner(): React.ReactNode {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setPlatform(detectPlatform());
    setDismissed(isStandalone() || localStorage.getItem(DISMISS_KEY) === '1');
  }, []);

  if (platform === null || platform === 'other' || dismissed) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  }

  return (
    <div className="flex items-start gap-3 border-b border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
      <div className="flex-1">
        <p className="font-medium">Tambahkan ke Layar Utama</p>
        <p className="mt-0.5 text-blue-800">
          {platform === 'ios'
            ? 'Supaya besok tidak perlu buka WhatsApp lagi: tekan tombol Bagikan di Safari, lalu pilih "Tambahkan ke Layar Utama".'
            : 'Supaya besok tidak perlu buka WhatsApp lagi: ketuk menu titik tiga, lalu pilih "Tambahkan ke Layar Utama" atau "Instal aplikasi".'}
        </p>
      </div>
      <button type="button" onClick={dismiss} className="shrink-0 text-blue-500 hover:text-blue-700" aria-label="Tutup">
        Nanti saja
      </button>
    </div>
  );
}
