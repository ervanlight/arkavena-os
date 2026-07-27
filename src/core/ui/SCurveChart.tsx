'use client';

import { useId } from 'react';
import { TrendingUp, Calendar, CheckCircle2, AlertCircle, ArrowUpRight } from 'lucide-react';

export interface SCurvePoint {
  date: string;
  planned: number; // 0 - 100
  actual: number | null; // 0 - 100 or null if future
}

export interface SCurveChartProps {
  title?: string;
  startDate?: string | null;
  targetCompletionDate?: string | null;
  points?: SCurvePoint[];
  currentActualProgress?: number;
  currentPlannedProgress?: number;
  className?: string;
}

// Generates an 8-week S-Curve dataset if no custom points are passed
function generateDefaultSCurvePoints(
  startDateStr?: string | null,
  targetDateStr?: string | null,
  actualPct: number = 48,
): { points: SCurvePoint[]; plannedNow: number; actualNow: number } {
  const start = startDateStr ? new Date(startDateStr) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const end = targetDateStr ? new Date(targetDateStr) : new Date(Date.now() + 45 * 24 * 3600 * 1000);
  const now = new Date();

  const totalDuration = Math.max(1, end.getTime() - start.getTime());
  const elapsedRatio = Math.min(1, Math.max(0, (now.getTime() - start.getTime()) / totalDuration));

  const numWeeks = 8;
  const points: SCurvePoint[] = [];

  for (let i = 0; i <= numWeeks; i++) {
    const t = i / numWeeks;
    // S-curve logistic function: 100 / (1 + exp(-7 * (t - 0.5)))
    const sValue = 100 / (1 + Math.exp(-7 * (t - 0.5)));
    const planned = Math.round(Math.min(100, Math.max(0, sValue)));

    const pointTime = new Date(start.getTime() + t * totalDuration);
    const dateLabel = pointTime.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

    let actual: number | null = null;
    if (t <= elapsedRatio || i === Math.floor(elapsedRatio * numWeeks)) {
      // Calculate actual progress proportional to elapsed time and actualPct target
      const actProgress = (t / Math.max(0.1, elapsedRatio)) * actualPct;
      actual = Math.round(Math.min(100, Math.max(0, actProgress)));
    }

    points.push({ date: dateLabel, planned, actual });
  }

  // Calculate current planned target at elapsed ratio
  const plannedNow = Math.round(100 / (1 + Math.exp(-7 * (elapsedRatio - 0.5))));
  const actualNow = actualPct;

  return { points, plannedNow, actualNow };
}

export function SCurveChart({
  title = 'Kurva S Progres Proyek',
  startDate,
  targetCompletionDate,
  points: customPoints,
  currentActualProgress = 48,
  currentPlannedProgress,
  className = '',
}: SCurveChartProps) {
  const gradientIdPlanned = useId();
  const gradientIdActual = useId();

  const { points, plannedNow, actualNow } = customPoints
    ? {
        points: customPoints,
        plannedNow: currentPlannedProgress ?? 45,
        actualNow: currentActualProgress,
      }
    : generateDefaultSCurvePoints(startDate, targetCompletionDate, currentActualProgress);

  const plannedCurrent = currentPlannedProgress ?? plannedNow;
  const actualCurrent = actualNow;
  const variance = Math.round((actualCurrent - plannedCurrent) * 10) / 10;
  const isAhead = variance >= 0;

  // Canvas / SVG Dimensions
  const width = 640;
  const height = 260;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 25;
  const padBottom = 35;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  // Convert points to SVG coordinates
  const svgPoints = points.map((p, idx) => {
    const x = padLeft + (idx / (points.length - 1)) * chartW;
    const yPlanned = padTop + (1 - p.planned / 100) * chartH;
    const yActual = p.actual !== null ? padTop + (1 - p.actual / 100) * chartH : null;
    return { ...p, x, yPlanned, yActual };
  });

  // Generate smooth SVG paths
  const plannedPathD = svgPoints.reduce((acc, p, idx) => {
    return idx === 0 ? `M ${p.x} ${p.yPlanned}` : `${acc} L ${p.x} ${p.yPlanned}`;
  }, '');

  const actualPoints = svgPoints.filter((p) => p.yActual !== null);
  const actualPathD = actualPoints.reduce((acc, p, idx) => {
    return idx === 0 ? `M ${p.x} ${p.yActual}` : `${acc} L ${p.x} ${p.yActual}`;
  }, '');

  const lastActual = actualPoints[actualPoints.length - 1];
  const firstActual = actualPoints[0];

  // Area fill under actual path
  const actualAreaD =
    actualPoints.length > 0 && lastActual !== undefined && firstActual !== undefined
      ? `${actualPathD} L ${lastActual.x} ${padTop + chartH} L ${firstActual.x} ${padTop + chartH} Z`
      : '';

  return (
    <div className={`rounded-[var(--radius-card)] bg-[color:var(--color-surface)] p-5 shadow-[var(--shadow-card)] border border-[color:var(--color-hairline)] space-y-4 ${className}`}>
      {/* Header & Metric Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[color:var(--color-hairline)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-blue-600" />
            <h3 className="text-base font-bold text-[color:var(--color-ink)]">{title}</h3>
          </div>
          <p className="mt-0.5 text-xs text-[color:var(--color-ink-tertiary)] flex items-center gap-1">
            <Calendar size={13} /> Target Baseline: {startDate ?? 'Mulai'} s/d {targetCompletionDate ?? 'Selesai'}
          </p>
        </div>

        {/* Status Pill */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-2xl font-extrabold text-emerald-600">{actualCurrent}%</span>
              <span className="text-xs font-semibold text-[color:var(--color-ink-tertiary)]">/ Rencana {plannedCurrent}%</span>
            </div>
            <div className="mt-0.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {isAhead ? (
                <>
                  <CheckCircle2 size={12} className="text-emerald-600" /> +{variance}% Terdepan Dari Jadwal
                </>
              ) : (
                <>
                  <AlertCircle size={12} className="text-amber-600" /> {variance}% Terlambat Dari Jadwal
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SVG S-Curve Chart */}
      <div className="relative w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
          <defs>
            <linearGradient id={gradientIdActual} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id={gradientIdPlanned} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines (0%, 25%, 50%, 75%, 100%) */}
          {[0, 25, 50, 75, 100].map((pct) => {
            const y = padTop + (1 - pct / 100) * chartH;
            return (
              <g key={pct}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="var(--color-hairline)"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text x={padLeft - 8} y={y + 4} textAnchor="end" className="text-[10px] fill-[color:var(--color-ink-tertiary)] font-medium">
                  {pct}%
                </text>
              </g>
            );
          })}

          {/* X Axis Labels */}
          {svgPoints.map((p, idx) => (
            <text key={idx} x={p.x} y={height - 10} textAnchor="middle" className="text-[10px] fill-[color:var(--color-ink-tertiary)] font-medium">
              {p.date}
            </text>
          ))}

          {/* Actual Fill Area */}
          {actualAreaD && <path d={actualAreaD} fill={`url(#${gradientIdActual})`} />}

          {/* Planned Line (Dashed Blue) */}
          <path d={plannedPathD} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeDasharray="5 4" opacity="0.8" />

          {/* Actual Line (Solid Emerald Green) */}
          {actualPathD && <path d={actualPathD} fill="none" stroke="#10b981" strokeWidth="3.5" strokeLinecap="round" />}

          {/* Dots on Actual Points */}
          {actualPoints.map((p, idx) => (
            <circle key={idx} cx={p.x} cy={p.yActual!} r="4" className="fill-emerald-500 stroke-white stroke-2" />
          ))}

          {/* Highlight Pulse Dot on Latest Actual Point */}
          {lastActual && (
            <g transform={`translate(${lastActual.x}, ${lastActual.yActual})`}>
              <circle r="7" className="fill-emerald-500 opacity-30 animate-ping" />
              <circle r="5" className="fill-emerald-600 stroke-white stroke-2" />
            </g>
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[color:var(--color-hairline)] text-xs text-[color:var(--color-ink-secondary)]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="h-0.5 w-5 bg-blue-500 border-b border-dashed border-blue-500" />
            <span className="font-medium">Kurva Rencana (Baseline)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-1 w-5 rounded bg-emerald-500" />
            <span className="font-semibold text-emerald-700">Realisasi Fisik Lapangan</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-medium text-[color:var(--color-ink-tertiary)]">
          <ArrowUpRight size={14} /> Diperbarui otomatis dari laporan harian
        </div>
      </div>
    </div>
  );
}
