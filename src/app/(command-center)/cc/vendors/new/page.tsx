import { NewVendorForm } from './vendor-form';

export const metadata = { title: 'Tambah vendor — BuildTrust OS' };

export default function NewVendorPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Tambah vendor</h1>
      <NewVendorForm />
    </div>
  );
}
