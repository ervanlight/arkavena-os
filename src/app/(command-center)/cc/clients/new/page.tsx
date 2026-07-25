import { PageHeader } from '@/core/ui';
import { NewClientForm } from './client-form';

export const metadata = { title: 'Tambah klien — Arkavena OS' };

export default function NewClientPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Tambah klien" />
      <NewClientForm />
    </div>
  );
}
