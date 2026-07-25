import { redirect } from 'next/navigation';
import { IssueForm } from './issue-form';

export const metadata = { title: 'Lapor Masalah — SiteFlow' };

export default async function IssuePage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const { projectId } = await searchParams;
  if (projectId === undefined) redirect('/site');

  return (
    <div className="space-y-4">
      <h1 className="text-[19px] font-semibold text-[color:var(--color-ink)]">Lapor Masalah</h1>
      <IssueForm projectId={projectId} />
    </div>
  );
}
