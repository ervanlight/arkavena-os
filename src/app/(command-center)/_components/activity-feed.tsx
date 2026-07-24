import {
  Camera,
  ClipboardList,
  TrendingUp,
  Boxes,
  TriangleAlert,
  GitBranch,
  Hammer,
  ShieldCheck,
  Receipt,
  Banknote,
  ShieldAlert,
  UserCheck,
  Calculator,
  FileSignature,
  Truck,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import type { ProjectActivityRow } from '@/modules/projects';
import { EmptyState } from '@/core/ui';

type EntityStyle = { icon: LucideIcon; tint: string; noun: string };

/**
 * How each audited entity reads to a human. Keyed by `entity_table` so a new
 * audited table falls through to a neutral default rather than breaking the
 * feed. Colour is meaning, not decoration -- red for risk/problems, green for
 * money-in/quality-passed, blue for commercial/commitment, the rest neutral.
 */
const ENTITY_STYLE: Record<string, EntityStyle> = {
  photos: { icon: Camera, tint: '#af52de', noun: 'Foto' },
  daily_logs: { icon: ClipboardList, tint: '#0a84ff', noun: 'Laporan harian' },
  progress_entries: { icon: TrendingUp, tint: '#34c759', noun: 'Progres pekerjaan' },
  material_requests: { icon: Boxes, tint: '#ff9f0a', noun: 'Permintaan material' },
  issues: { icon: TriangleAlert, tint: '#ff453a', noun: 'Masalah lapangan' },
  change_orders: { icon: GitBranch, tint: '#0a84ff', noun: 'Variation' },
  work_packages: { icon: Hammer, tint: '#6e6e73', noun: 'Paket kerja' },
  inspections: { icon: ShieldCheck, tint: '#34c759', noun: 'Inspeksi mutu' },
  nonconformities: { icon: TriangleAlert, tint: '#ff453a', noun: 'Ketidaksesuaian' },
  invoices: { icon: Receipt, tint: '#0a84ff', noun: 'Invoice' },
  payments: { icon: Banknote, tint: '#34c759', noun: 'Pembayaran' },
  funding_receipts: { icon: Banknote, tint: '#34c759', noun: 'Dana termin' },
  cash_gate_overrides: { icon: ShieldAlert, tint: '#ff453a', noun: 'Override Cash Gate' },
  client_decisions: { icon: UserCheck, tint: '#af52de', noun: 'Keputusan klien' },
  estimates: { icon: Calculator, tint: '#6e6e73', noun: 'Estimasi' },
  proposals: { icon: FileSignature, tint: '#6e6e73', noun: 'Proposal' },
  purchase_orders: { icon: Truck, tint: '#0a84ff', noun: 'Purchase order' },
  vendor_quotes: { icon: FileText, tint: '#6e6e73', noun: 'Penawaran vendor' },
  deliveries: { icon: Truck, tint: '#34c759', noun: 'Pengiriman' },
};

const DEFAULT_STYLE: EntityStyle = { icon: FileText, tint: '#8e8e93', noun: 'Catatan' };

/** Verb suffix per action -- appended to the entity noun ("Foto baru", "Invoice disetujui"). */
const ACTION_SUFFIX: Record<ProjectActivityRow['action'], string> = {
  insert: 'baru',
  update: 'diperbarui',
  status_change: 'ubah status',
  delete: 'dihapus',
  approve: 'disetujui',
  reject: 'ditolak',
  override: 'di-override',
  login: 'masuk',
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return 'baru saja';
  if (min < 60) return `${min} menit lalu`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  const day = Math.round(hr / 24);
  if (day === 1) return 'kemarin';
  if (day < 7) return `${day} hari lalu`;
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

type ActivityEvent = ProjectActivityRow & { projectName?: string | null };

/**
 * The activity journal: every audited event as a readable row. Used both for
 * a single project's Aktivitas tab and (with `projectName` populated) the
 * Command Center dashboard's cross-project recent-activity feed.
 */
export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return <EmptyState title="Belum ada aktivitas" description="Aktivitas lapangan dan keputusan proyek akan muncul di sini." />;
  }

  return (
    <ul className="space-y-1.5">
      {events.map((event) => {
        const style = ENTITY_STYLE[event.entityTable] ?? DEFAULT_STYLE;
        const Icon = style.icon;
        const title = `${style.noun} ${ACTION_SUFFIX[event.action]}`;
        const meta = [event.projectName, event.actorName, relativeTime(event.occurredAt)].filter(Boolean).join(' · ');
        return (
          <li
            key={event.id}
            className="flex gap-3 rounded-[var(--radius-card)] bg-[color:var(--color-surface)] p-3.5 shadow-[var(--shadow-card)]"
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
              style={{ backgroundColor: `${style.tint}1f` }}
            >
              <Icon size={17} color={style.tint} strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-[color:var(--color-ink)]">{title}</p>
              <p className="mt-0.5 truncate text-xs text-[color:var(--color-ink-tertiary)]">{meta}</p>
              {event.reason !== null && event.reason !== '' && (
                <p className="mt-1.5 rounded-[8px] bg-[color:var(--color-surface-secondary)] px-2.5 py-1.5 text-xs text-[color:var(--color-ink-secondary)]">
                  “{event.reason}”
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
