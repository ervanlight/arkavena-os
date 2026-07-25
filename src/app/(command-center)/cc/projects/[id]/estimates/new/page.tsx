import { NewEstimateForm } from './estimate-form';

export const metadata = { title: 'Buat estimasi — BuildTrust OS' };

export default async function NewEstimatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Buat estimasi</h2>
      <NewEstimateForm projectId={id} />
    </div>
  );
}
