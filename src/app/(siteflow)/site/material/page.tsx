import { redirect } from 'next/navigation';
import { MaterialRequestForm } from './material-request-form';

export const metadata = { title: 'Minta Material — SiteFlow' };

export default async function MaterialRequestPage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const { projectId } = await searchParams;
  if (projectId === undefined) redirect('/site');

  return (
    <div className="space-y-4">
      <h1 className="text-[19px] font-semibold text-[color:var(--color-ink)]">Minta Material</h1>
      <MaterialRequestForm projectId={projectId} />
    </div>
  );
}
