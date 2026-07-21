import { listClientsAction } from '@/modules/crm';
import { NewProjectForm } from './new-project-form';

export const metadata = { title: 'Tambah proyek — BuildTrust OS' };

export default async function NewProjectPage() {
  const clientsResult = await listClientsAction(undefined);
  const clients = clientsResult.ok ? clientsResult.data : [];

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Tambah proyek</h1>
      <NewProjectForm clients={clients} />
    </div>
  );
}
