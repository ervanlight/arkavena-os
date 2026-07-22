import Link from 'next/link';
import type { Route } from 'next';
import { getCurrentUser } from '@/core/auth/session';
import { listMyFieldProjectsAction } from '@/modules/projects';

export const metadata = { title: 'SiteFlow — BuildTrust OS' };

const MENU = [
  { href: 'laporan-harian', label: 'Laporan Harian', hint: 'Cuaca, jumlah pekerja, catatan hari ini' },
  { href: 'progress', label: 'Update Progress', hint: 'Persentase pekerjaan per paket kerja' },
  { href: 'foto', label: 'Ambil Foto', hint: 'Foto lokasi, terikat proyek + zona' },
  { href: 'material', label: 'Minta Material', hint: 'Ajukan kebutuhan material ke kantor' },
  { href: 'masalah', label: 'Lapor Masalah', hint: 'Catat kendala di lapangan' },
  { href: 'riwayat', label: 'Riwayat Laporan', hint: 'Lihat laporan yang sudah diinput' },
];

export default async function SiteFlowHomePage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const [user, projectsResult, { projectId }] = await Promise.all([
    getCurrentUser(),
    listMyFieldProjectsAction(undefined),
    searchParams,
  ]);

  const projects = projectsResult.ok ? projectsResult.data : [];

  if (projects.length === 0) {
    return (
      <div className="rounded-lg bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-500">Halo,</p>
        <p className="text-lg font-semibold text-slate-900">{user?.fullName}</p>
        <p className="mt-3 text-sm text-slate-600">
          Anda belum terdaftar sebagai site coordinator/mandor di proyek manapun. Hubungi admin kantor.
        </p>
      </div>
    );
  }

  const selectedProject = projectId !== undefined ? (projects.find((p) => p.id === projectId) ?? null) : null;

  if (selectedProject === null && projects.length > 1) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-700">Pilih proyek</p>
        {projects.map((project) => (
          <Link
            key={project.id}
            href={`/site?projectId=${project.id}`}
            className="block rounded-lg bg-white p-4 text-base font-medium text-slate-900 shadow-sm active:bg-slate-100"
          >
            {project.name}
          </Link>
        ))}
      </div>
    );
  }

  const project = selectedProject ?? projects[0]!;

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-500">Proyek</p>
        <p className="text-lg font-semibold text-slate-900">{project.name}</p>
        {projects.length > 1 && (
          <Link href="/site" className="mt-1 inline-block text-xs font-medium text-blue-600 underline">
            Ganti proyek
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {MENU.map((item) => (
          <Link
            key={item.href}
            // typedRoutes only recognises literal route strings, not a
            // template built from an array element -- these six are all
            // real pages under (siteflow)/site/, so the cast is safe.
            href={`/site/${item.href}?projectId=${project.id}` as Route}
            className="flex min-h-28 flex-col justify-center rounded-xl bg-white p-4 text-center shadow-sm active:bg-slate-100"
          >
            <span className="text-base font-semibold text-slate-900">{item.label}</span>
            <span className="mt-1 text-xs text-slate-500">{item.hint}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
