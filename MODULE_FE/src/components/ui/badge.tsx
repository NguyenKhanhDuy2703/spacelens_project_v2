import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-mono font-medium transition-colors focus:outline-none',
  {
    variants: {
      variant: {
        default: 'border-slate-700 bg-slate-800 text-slate-300',
        success: 'border-emerald-700/50 bg-emerald-950/60 text-emerald-400',
        warning: 'border-yellow-700/50 bg-yellow-950/60 text-yellow-400',
        danger: 'border-red-700/50 bg-red-950/60 text-red-400',
        info: 'border-cyan-700/50 bg-cyan-950/60 text-cyan-400',
        outline: 'border-slate-600 bg-transparent text-slate-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
