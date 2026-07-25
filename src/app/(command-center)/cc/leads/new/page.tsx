import { PageHeader } from '@/core/ui';
import { NewLeadForm } from './lead-form';

export const metadata = { title: 'Tambah lead — BuildTrust OS' };

export default function NewLeadPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Tambah lead" />
      <NewLeadForm />
    </div>
  );
}
