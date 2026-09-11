import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export function CameraCardSkeleton(): React.JSX.Element {
  return (
    <div className="card-panel overflow-hidden flex flex-col justify-between p-0 border border-slate-800 bg-[#0B0F17]/80 rounded-xl shadow-lg">
      {/* 1. Header Skeleton */}
      <div className="p-4 flex items-center justify-between border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-lg bg-slate-800" />
          <div className="space-y-1.5">
            <Skeleton className="w-32 h-4 rounded bg-slate-800" />
            <Skeleton className="w-20 h-3 rounded bg-slate-800/70" />
          </div>
        </div>
        <Skeleton className="w-16 h-6 rounded-full bg-slate-800" />
      </div>

      {/* 2. Video Preview Screen Skeleton */}
      <div className="relative aspect-video w-full bg-slate-900/90 flex items-center justify-center p-4">
        <Skeleton className="w-full h-full rounded bg-slate-800/50" />
        <div className="absolute top-3 left-3">
          <Skeleton className="w-16 h-5 rounded bg-slate-800/80" />
        </div>
        <div className="absolute bottom-3 right-3 flex gap-2">
          <Skeleton className="w-14 h-4 rounded bg-slate-800/80" />
          <Skeleton className="w-12 h-4 rounded bg-slate-800/80" />
        </div>
      </div>

      {/* 3. Metadata Info Skeleton */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="w-24 h-3.5 rounded bg-slate-800/70" />
          <Skeleton className="w-28 h-3.5 rounded bg-slate-800/70" />
        </div>
        <Skeleton className="w-full h-8 rounded bg-slate-800/50" />
      </div>

      {/* 4. Action Buttons Footer */}
      <div className="p-4 pt-0 flex items-center justify-between gap-2 border-t border-slate-800/60 mt-auto">
        <Skeleton className="w-28 h-8 rounded bg-slate-800" />
        <div className="flex gap-2">
          <Skeleton className="w-8 h-8 rounded bg-slate-800" />
          <Skeleton className="w-8 h-8 rounded bg-slate-800" />
        </div>
      </div>
    </div>
  );
}

export function CameraTableSkeleton(): React.JSX.Element {
  return (
    <div className="card-panel overflow-hidden p-0 border border-slate-800 bg-[#0B0F17]/80 rounded-xl">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <Skeleton className="w-40 h-5 rounded bg-slate-800" />
        <Skeleton className="w-24 h-4 rounded bg-slate-800" />
      </div>
      <div className="divide-y divide-slate-800/60">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 rounded bg-slate-800" />
              <div className="space-y-1">
                <Skeleton className="w-36 h-4 rounded bg-slate-800" />
                <Skeleton className="w-24 h-3 rounded bg-slate-800/60" />
              </div>
            </div>
            <Skeleton className="w-28 h-4 rounded bg-slate-800/70 hidden sm:block" />
            <Skeleton className="w-20 h-6 rounded-full bg-slate-800" />
            <div className="flex gap-2">
              <Skeleton className="w-8 h-8 rounded bg-slate-800" />
              <Skeleton className="w-8 h-8 rounded bg-slate-800" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
