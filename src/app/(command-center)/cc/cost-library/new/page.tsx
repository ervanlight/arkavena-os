import { NewCostLibraryItemForm } from './cost-library-form';

export const metadata = { title: 'Tambah item cost library — BuildTrust OS' };

export default function NewCostLibraryItemPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Tambah item cost library</h1>
      <NewCostLibraryItemForm />
    </div>
  );
}
