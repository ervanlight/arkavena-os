import { BarChart2, Clock } from 'lucide-react';

export default function ClientPortalLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded-lg bg-[#2A2A2A]" />
          <div className="space-y-2">
            <div className="h-5 w-48 rounded bg-[#2A2A2A]" />
            <div className="h-3 w-28 rounded bg-[#2A2A2A]" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-8 w-20 rounded bg-[#2A2A2A]" />
          <div className="h-9 w-28 rounded bg-[#2A2A2A]" />
        </div>
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-6 border-b border-white/10 mb-6 pb-3">
        <div className="h-5 w-24 rounded bg-[#2A2A2A]" />
        <div className="h-5 w-24 rounded bg-[#2A2A2A]" />
        <div className="h-5 w-24 rounded bg-[#2A2A2A]" />
        <div className="h-5 w-24 rounded bg-[#2A2A2A]" />
      </div>

      {/* 2-Column Grid Skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column */}
        <div className="space-y-6 lg:col-span-2">
          {/* OVERALL PROGRESS */}
          <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-6 space-y-4">
            <div className="flex items-center gap-2">
              <BarChart2 size={16} className="text-gray-600" />
              <div className="h-3 w-32 rounded bg-[#2A2A2A]" />
            </div>
            <div className="h-2 w-full rounded-full bg-[#2A2A2A]" />
            <div className="h-4 w-40 rounded bg-[#2A2A2A]" />
          </div>

          {/* RECENT ACTIVITY */}
          <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-6 space-y-6">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-gray-600" />
              <div className="h-3 w-36 rounded bg-[#2A2A2A]" />
            </div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4 items-center">
                  <div className="h-8 w-8 rounded-full bg-[#2A2A2A]" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-3/4 rounded bg-[#2A2A2A]" />
                    <div className="h-3 w-1/2 rounded bg-[#2A2A2A]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* ACTION REQUIRED */}
          <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-6 space-y-4">
            <div className="h-3 w-32 rounded bg-[#2A2A2A]" />
            <div className="h-24 rounded-lg bg-[#222] border border-white/5" />
          </div>

          {/* PAYMENT TERMS */}
          <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-6 space-y-4">
            <div className="h-3 w-32 rounded bg-[#2A2A2A]" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="h-4 w-28 rounded bg-[#2A2A2A]" />
                  <div className="h-4 w-12 rounded bg-[#2A2A2A]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
