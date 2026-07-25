import { PageHeader } from '@/core/ui';
import { NewVendorForm } from './vendor-form';

export const metadata = { title: 'Tambah vendor — BuildTrust OS' };

export default function NewVendorPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Tambah vendor" />
      <NewVendorForm />
    </div>
  );
}
