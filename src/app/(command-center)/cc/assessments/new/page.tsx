import { listLeadsAction, listSitesAction } from '@/modules/crm';
import { PageHeader } from '@/core/ui';
import { NewAssessmentForm } from './assessment-form';

export const metadata = { title: 'Tambah assessment — Arkavena OS' };

export default async function NewAssessmentPage() {
  const [sitesResult, leadsResult] = await Promise.all([listSitesAction(undefined), listLeadsAction(undefined)]);

  return (
    <div className="space-y-6">
      <PageHeader title="Tambah assessment" />
      <NewAssessmentForm
        sites={sitesResult.ok ? sitesResult.data : []}
        leads={leadsResult.ok ? leadsResult.data : []}
      />
    </div>
  );
}
