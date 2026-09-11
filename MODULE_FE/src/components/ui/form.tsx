import React from 'react';
import { cn } from '@/utils/cn';

// --- FormField: Label + content wrapper ---
interface FormFieldProps {
  label: string;
  required?: boolean;
  helper?: string;
  className?: string;
  children: React.ReactNode;
}

export function FormField({ label, required, helper, className, children }: FormFieldProps) {
  return (
    <div className={cn('form-group', className)}>
      <label className="form-label">
        {label}
        {required && <span className="text-cyan-500 ml-0.5">*</span>}
      </label>
      {children}
      {helper && <span className="form-helper">{helper}</span>}
    </div>
  );
}

// --- FormInput: Styled text/number input ---
interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  mono?: boolean;
  uppercase?: boolean;
}

export function FormInput({ mono, uppercase, className, ...props }: FormInputProps) {
  return (
    <input
      className={cn(
        'form-input',
        mono && 'font-mono',
        uppercase && 'uppercase',
        className
      )}
      {...props}
    />
  );
}

// --- FormSelect: Styled select dropdown ---
interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children: React.ReactNode;
}

export function FormSelect({ className, children, ...props }: FormSelectProps) {
  return (
    <select className={cn('form-select', className)} {...props}>
      {children}
    </select>
  );
}

// --- FormSectionHeader: Section divider title inside form ---
interface FormSectionHeaderProps {
  icon: React.ReactNode;
  title: string;
}

export function FormSectionHeader({ icon, title }: FormSectionHeaderProps) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-border)] text-xs font-semibold text-[var(--color-primary)]">
      {icon}
      <span>{title}</span>
    </div>
  );
}
