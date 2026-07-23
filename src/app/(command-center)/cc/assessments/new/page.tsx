import { listLeadsAction, listSitesAction } from '@/modules/crm';
import { NewAssessmentForm } from './assessment-form';

export const metadata = { title: 'Tambah assessment — BuildTrust OS' };

export default async function NewAssessmentPage() {
  const [sitesResult, leadsResult] = await Promise.all([listSitesAction(undefined), listLeadsAction(undefined)]);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Tambah assessment</h1>
      <NewAssessmentForm
        sites={sitesResult.ok ? sitesResult.data : []}
        leads={leadsResult.ok ? leadsResult.data : []}
      />
    </div>
  );
}
