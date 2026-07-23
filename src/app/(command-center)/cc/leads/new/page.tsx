import { NewLeadForm } from './lead-form';

export const metadata = { title: 'Tambah lead — BuildTrust OS' };

export default function NewLeadPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Tambah lead</h1>
      <NewLeadForm />
    </div>
  );
}
