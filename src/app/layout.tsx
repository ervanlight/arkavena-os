import type { Metadata, Viewport } from 'next';
import './globals.css';
import { RegisterServiceWorker } from '@/core/pwa/register-service-worker';

export const metadata: Metadata = {
  title: 'BuildTrust OS',
  description: 'Sistem pengendalian proyek konstruksi',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    // iOS's "Add to Home Screen" reads this specific tag, not the web
    // manifest's `icons` array at all.
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f172a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}
