import { PageHeader } from '@/core/ui';
import { NewCostLibraryItemForm } from './cost-library-form';

export const metadata = { title: 'Tambah item cost library — BuildTrust OS' };

export default function NewCostLibraryItemPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Tambah item cost library" />
      <NewCostLibraryItemForm />
    </div>
  );
}
