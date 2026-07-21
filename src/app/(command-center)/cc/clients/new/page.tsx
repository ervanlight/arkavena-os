import { NewClientForm } from './client-form';

export const metadata = { title: 'Tambah klien — BuildTrust OS' };

export default function NewClientPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Tambah klien</h1>
      <NewClientForm />
    </div>
  );
}
