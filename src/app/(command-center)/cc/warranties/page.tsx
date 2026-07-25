import { listWarrantiesAction, warrantyExpiryTier, type WarrantyExpiryTier } from '@/modules/maintenance-engine';
import { Card, PageHeader, EmptyState, StatusBadge } from '@/core/ui';
import { MarkWarrantyExpiredForm } from './mark-warranty-expired-form';

export const metadata = { title: 'Garansi — Arkavena OS' };

/**
 * Phase 3 (F18): warranty-expiry relationship-transition touchpoint.
 * WORKFLOW_REVIEW.md 8.4 frames this as a business-development moment for
 * the Owner (referrals, repeat business, a maintenance-contract offer), not
 * a risk -- manual version only (IMPLEMENTATION_PLAN.md 3.3): a staff view
 * of every warranty's expiry window, from which staff click through to the
 * existing updateWarrantyAction. No automated reminder (that needs F11's
 * notification infrastructure, the soft-block IMPLEMENTATION_PLAN.md
 * already names).
 */

const TIER_LABEL_ID: Record<WarrantyExpiryTier, string> = {
  active: 'Masih aktif',
  expiring_soon: 'Akan berakhir (≤30 hari)',
  expired: 'Sudah berakhir',
};

const TIER_TONE: Record<WarrantyExpiryTier, 'success' | 'warning' | 'danger'> = {
  active: 'success',
  expiring_soon: 'warning',
  expired: 'danger',
};

export default async function WarrantiesPage() {
  const result = await listWarrantiesAction(undefined);
  const warranties = result.ok ? result.data : [];
  const now = Date.now();

  return (
    <div className="space-y-6">
      <PageHeader title="Garansi" />

      {!result.ok && (
        <p role="alert" className="text-sm text-[color:var(--color-danger)]">
          {result.error.message}
        </p>
      )}

      {result.ok && warranties.length === 0 && <EmptyState title="Belum ada garansi tercatat" />}

      {warranties.length > 0 && (
        <Card>
          <ul className="divide-y divide-[color:var(--color-hairline)]">
            {warranties.map((warranty) => {
              const tier = warrantyExpiryTier(new Date(warranty.ends_at).getTime(), now);
              return (
                <li key={warranty.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium text-[color:var(--color-ink)]">{warranty.title}</p>
                    <p className="mt-0.5 text-xs text-[color:var(--color-ink-tertiary)]">
                      Berakhir {new Date(warranty.ends_at).toLocaleDateString('id-ID')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <StatusBadge tone={TIER_TONE[tier]}>{TIER_LABEL_ID[tier]}</StatusBadge>
                    {warranty.status === 'active' && <MarkWarrantyExpiredForm warrantyId={warranty.id} />}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
