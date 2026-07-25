import { listClientsAction } from '@/modules/crm';
import { PageHeader } from '@/core/ui';
import { NewProjectForm } from './new-project-form';

export const metadata = { title: 'Tambah proyek — Arkavena OS' };

export default async function NewProjectPage() {
  const clientsResult = await listClientsAction(undefined);
  const clients = clientsResult.ok ? clientsResult.data : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Tambah proyek" />
      <NewProjectForm clients={clients} />
    </div>
  );
}
