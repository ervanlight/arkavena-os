import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BuildTrust OS',
  description: 'Sistem pengendalian proyek konstruksi',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
