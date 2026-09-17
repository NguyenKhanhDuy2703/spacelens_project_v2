import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

const alertVariants = cva(
  'relative w-full rounded-lg border p-3.5 flex gap-3 text-sm',
  {
    variants: {
      variant: {
        default: 'bg-slate-900/60 border-slate-700 text-slate-300',
        destructive: 'bg-red-950/40 border-red-800/50 text-red-300',
        success: 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300',
        warning: 'bg-yellow-950/40 border-yellow-800/50 text-yellow-300',
        info: 'bg-cyan-950/40 border-cyan-800/50 text-cyan-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = 'Alert';

const AlertIcon = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span className={cn('shrink-0 mt-0.5', className)}>{children}</span>
);
AlertIcon.displayName = 'AlertIcon';

const AlertContent = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('flex-1 min-w-0', className)}>{children}</div>
);
AlertContent.displayName = 'AlertContent';

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn('font-semibold leading-tight mb-0.5 text-sm', className)} {...props} />
  )
);
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-xs leading-relaxed opacity-85', className)} {...props} />
  )
);
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertIcon, AlertContent, AlertTitle, AlertDescription };
