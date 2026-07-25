import { listHoldPointTemplatesAction } from '@/modules/quality-gate';
import { Card, PageHeader, StatusBadge, EmptyState } from '@/core/ui';
import { CreateHoldPointTemplateForm } from './create-hold-point-template-form';

export const metadata = { title: 'Quality Gate — BuildTrust OS' };

export default async function QualityGatePage() {
  const result = await listHoldPointTemplatesAction(undefined);
  const templates = result.ok ? result.data : [];

  const byWorkType = new Map<string, typeof templates>();
  for (const template of templates) {
    const list = byWorkType.get(template.work_type) ?? [];
    list.push(template);
    byWorkType.set(template.work_type, list);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Quality Gate — Hold Point"
        subtitle="Template hold point per jenis pekerjaan. Berlaku otomatis untuk setiap paket kerja yang diberi jenis pekerjaan yang sama."
      />

      <Card>
        <h2 className="text-[17px] font-semibold text-[color:var(--color-ink)]">Tambah hold point</h2>
        <div className="mt-4">
          <CreateHoldPointTemplateForm />
        </div>
      </Card>

      <div className="space-y-6">
        {byWorkType.size === 0 && <EmptyState title="Belum ada hold point" />}
        {[...byWorkType.entries()].map(([workType, items]) => (
          <Card key={workType}>
            <h3 className="text-[15px] font-semibold text-[color:var(--color-ink)]">{workType}</h3>
            <ul className="mt-3 divide-y divide-[color:var(--color-hairline)]">
              {items.map((template) => (
                <li key={template.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-[color:var(--color-ink)]">{template.name}</span>
                  {!template.is_active && <StatusBadge tone="neutral">Nonaktif</StatusBadge>}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
