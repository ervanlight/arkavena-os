import Link from 'next/link';
import { AlertTriangle, Receipt, MessageCircleWarning, TriangleAlert, type LucideIcon } from 'lucide-react';
import { getCurrentUser } from '@/core/auth/session';
import { listOrgActivityAction, listProjectsAction, listWorkPackagesForProjectAction, type Project } from '@/modules/projects';
import { listIssuesForProjectAction } from '@/modules/field-reporting';
import { listPendingClientDecisionsAction } from '@/modules/client-portal';
import { listAgingDashboardAction } from '@/modules/billing';
import { getGateStateAction, type CashGateStatus } from '@/modules/cash-gate';
import { Card, PageHeader, StatusBadge, EmptyState } from '@/core/ui';
import { ActivityFeed } from '../_components/activity-feed';

export const metadata = { title: 'Command Center — Arkavena OS' };

const PROJECT_STATUS_LABEL: Record<string, string> = {
  planning: 'Perencanaan',
  in_progress: 'Berjalan',
  on_hold: 'Ditunda',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

const PROJECT_STATUS_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'success'> = {
  planning: 'neutral',
  in_progress: 'info',
  on_hold: 'warning',
  completed: 'success',
  cancelled: 'neutral',
};

const GATE_DOT_COLOR: Record<CashGateStatus, string> = {
  green: '#34c759',
  yellow: '#ff9f0a',
  red: '#ff453a',
  overdue: '#ff453a',
};

const ACTIVE_STATUSES = new Set(['planning', 'in_progress', 'on_hold']);

type AttentionItem = { key: string; icon: LucideIcon; tint: string; label: string; href: string };

async function loadProjectSummary(project: Project) {
  const [gateResult, workPackagesResult, decisionsResult, issuesResult] = await Promise.all([
    getGateStateAction(project.id),
    listWorkPackagesForProjectAction(project.id),
    listPendingClientDecisionsAction(project.id),
    listIssuesForProjectAction(project.id),
  ]);

  const workPackages = workPackagesResult.ok ? workPackagesResult.data : [];
  const percentDone =
    workPackages.length === 0
      ? null
      : Math.round(
          (workPackages.filter((wp) => wp.status === 'completed').length / workPackages.length) * 100,
        );

  const overdueDecisions = decisionsResult.ok ? decisionsResult.data.filter((decision) => decision.clockTier === 'overdue') : [];
  const openHighSeverityIssues = issuesResult.ok
    ? issuesResult.data.filter((issue) => issue.status === 'open' && issue.severity === 'high')
    : [];

  return {
    project,
    gate: gateResult.ok ? gateResult.data : null,
    percentDone,
    overdueDecisions,
    openHighSeverityIssues,
  };
}

/**
 * The real Command Center landing page. Owner critique: after login staff
 * got a greeting and nothing else -- no wayfinding into which project needs
 * them today. This surfaces every active project's health at a glance, a
 * "Perlu perhatian" strip aggregating what's overdue/red across all of them
 * (Cash Gate, invoices, client decisions, field issues), and the org-wide
 * activity journal below it.
 */
export default async function CommandCenterHome() {
  const [user, projectsResult, activityResult, agingResult] = await Promise.all([
    getCurrentUser(),
    listProjectsAction(undefined),
    listOrgActivityAction(undefined),
    listAgingDashboardAction(undefined),
  ]);

  const hour = new Date().getHours();
  const greeting = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : 'Selamat sore';

  const allProjects = projectsResult.ok ? projectsResult.data : [];
  const activeProjects = allProjects.filter((p) => ACTIVE_STATUSES.has(p.status));
  const summaries = await Promise.all(activeProjects.map(loadProjectSummary));

  const overdueInvoices = agingResult.ok ? agingResult.data.filter((inv) => inv.agingTier !== 'current') : [];

  const attentionItems: AttentionItem[] = [];
  for (const s of summaries) {
    if (s.gate !== null && (s.gate.status === 'red' || s.gate.status === 'overdue')) {
      attentionItems.push({
        key: `gate-${s.project.id}`,
        icon: AlertTriangle,
        tint: '#ff453a',
        label: `Cash Gate ${s.gate.status === 'red' ? 'merah' : 'jatuh tempo'} — ${s.project.name}`,
        href: `/cc/projects/${s.project.id}/cash-gate`,
      });
    }
    if (s.overdueDecisions.length > 0) {
      attentionItems.push({
        key: `decisions-${s.project.id}`,
        icon: MessageCircleWarning,
        tint: '#af52de',
        label: `${s.overdueDecisions.length} keputusan klien terlambat — ${s.project.name}`,
        href: `/cc/projects/${s.project.id}/aktivitas`,
      });
    }
    if (s.openHighSeverityIssues.length > 0) {
      attentionItems.push({
        key: `issues-${s.project.id}`,
        icon: TriangleAlert,
        tint: '#ff453a',
        label: `${s.openHighSeverityIssues.length} masalah berat terbuka — ${s.project.name}`,
        href: `/cc/projects/${s.project.id}/aktivitas`,
      });
    }
  }
  if (overdueInvoices.length > 0) {
    attentionItems.push({
      key: 'invoices-overdue',
      icon: Receipt,
      tint: '#ff9f0a',
      label: `${overdueInvoices.length} invoice jatuh tempo`,
      href: '/cc/billing',
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title={`${greeting}, ${user?.fullName?.split(' ')[0] ?? ''}`} subtitle={user?.organizationName} />

      {attentionItems.length > 0 && (
        <div className="space-y-2">
          <h2 className="px-0.5 text-[13px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-tertiary)]">
            Perlu perhatian
          </h2>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {attentionItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.key}
                  href={item.href as never}
                  className="flex shrink-0 items-center gap-2 rounded-full bg-[color:var(--color-surface)] py-2 pl-2.5 pr-3.5 text-[13px] font-medium text-[color:var(--color-ink)] shadow-[var(--shadow-card)]"
                >
                  <Icon size={15} color={item.tint} strokeWidth={2.3} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h2 className="px-0.5 text-[13px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-tertiary)]">Proyek aktif</h2>
        {summaries.length === 0 ? (
          <EmptyState title="Belum ada proyek aktif" description="Proyek yang sedang berjalan akan muncul di sini." />
        ) : (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {summaries.map(({ project, gate, percentDone }) => (
              <Link key={project.id} href={`/cc/projects/${project.id}` as never}>
                <Card interactive className="h-full">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-[16px] font-semibold text-[color:var(--color-ink)]">{project.name}</p>
                    {gate !== null && (
                      <span
                        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: GATE_DOT_COLOR[gate.status] }}
                        title={`Cash Gate: ${gate.status}`}
                      />
                    )}
                  </div>
                  <div className="mt-2">
                    <StatusBadge tone={PROJECT_STATUS_TONE[project.status] ?? 'neutral'}>
                      {PROJECT_STATUS_LABEL[project.status] ?? project.status}
                    </StatusBadge>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-[color:var(--color-ink-tertiary)]">
                      <span>Progres paket kerja</span>
                      <span>{percentDone !== null ? `${percentDone}%` : '—'}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[color:var(--color-surface-secondary)]">
                      <div className="h-full rounded-full bg-[color:var(--color-accent)]" style={{ width: `${percentDone ?? 0}%` }} />
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="px-0.5 text-[13px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-tertiary)]">
          Aktivitas terbaru
        </h2>
        <ActivityFeed events={activityResult.ok ? activityResult.data : []} />
      </div>
    </div>
  );
}
