import { NewEstimateForm } from './estimate-form';

export const metadata = { title: 'Buat estimasi — BuildTrust OS' };

export default async function NewEstimatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Buat estimasi</h1>
      <NewEstimateForm projectId={id} />
    </div>
  );
}
