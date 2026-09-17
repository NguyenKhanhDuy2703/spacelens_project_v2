import React from 'react';
import { cn } from '@/utils/cn';

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-slate-800/70 border border-slate-700/30',
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
