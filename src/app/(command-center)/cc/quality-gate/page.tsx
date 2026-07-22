import { listHoldPointTemplatesAction } from '@/modules/quality-gate';
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
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Quality Gate — Hold Point</h1>
        <p className="mt-1 text-sm text-slate-500">
          Template hold point per jenis pekerjaan. Berlaku otomatis untuk setiap paket kerja yang diberi jenis
          pekerjaan yang sama.
        </p>
      </div>

      <div className="rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Tambah hold point</h2>
        <div className="mt-4">
          <CreateHoldPointTemplateForm />
        </div>
      </div>

      <div className="space-y-6">
        {byWorkType.size === 0 && <p className="text-sm text-slate-500">Belum ada hold point.</p>}
        {[...byWorkType.entries()].map(([workType, items]) => (
          <div key={workType} className="rounded-lg bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">{workType}</h3>
            <ul className="mt-3 divide-y divide-slate-100">
              {items.map((template) => (
                <li key={template.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-900">{template.name}</span>
                  {!template.is_active && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Nonaktif</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
