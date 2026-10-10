import React from 'react';

export interface StatusBadgeProps {
  status:
    | 'connected'
    | 'in-memory-fallback'
    | 'disconnected'
    | 'ok'
    | 'error'
    | 'warning'
    | 'degraded';
  label?: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, className = '' }) => {
  const displayLabel = label || status;

  let colorClasses = 'bg-slate-900 text-slate-300 border-slate-800';
  let indicatorColor = 'bg-slate-400';

  if (status === 'connected' || status === 'ok') {
    colorClasses = 'bg-emerald-950/70 text-emerald-300 border-emerald-800/70';
    indicatorColor = 'bg-emerald-400';
  } else if (status === 'in-memory-fallback' || status === 'warning' || status === 'degraded') {
    colorClasses = 'bg-amber-950/70 text-amber-300 border-amber-800/70';
    indicatorColor = 'bg-amber-400';
  } else if (status === 'disconnected' || status === 'error') {
    colorClasses = 'bg-rose-950/70 text-rose-300 border-rose-800/70';
    indicatorColor = 'bg-rose-400';
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium border tabular-nums transition-colors ${colorClasses} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${indicatorColor} shrink-0`} />
      <span className="capitalize">{displayLabel}</span>
    </span>
  );
};

export interface CardProps {
  title?: string;
  description?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({
  title,
  description,
  headerAction,
  children,
  className = '',
  noPadding = false,
}) => {
  const hasHeader = Boolean(title || description || headerAction);
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-xs ${className}`}>
      {hasHeader && (
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-start justify-between gap-4">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-100">{title}</h3>}
            {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-5'}>{children}</div>
    </div>
  );
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  className = '',
  children,
  ...props
}) => {
  const base =
    'inline-flex items-center justify-center font-medium transition-colors select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg';

  const sizeClasses = {
    sm: 'text-xs px-2.5 py-1.5 h-8 gap-1.5',
    md: 'text-xs px-3.5 py-2 h-9 gap-2',
    lg: 'text-sm px-4 py-2.5 h-10 gap-2',
  }[size];

  const variantClasses = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-500 active:bg-emerald-700 shadow-xs border border-emerald-500/30',
    secondary: 'bg-slate-800 text-slate-200 hover:bg-slate-700 active:bg-slate-800 border border-slate-700/80',
    outline: 'border border-slate-700 text-slate-300 hover:bg-slate-800/80 hover:text-white hover:border-slate-600',
    danger: 'bg-rose-950/50 text-rose-300 hover:bg-rose-900/60 hover:text-rose-100 border border-rose-800/80 active:bg-rose-900',
    ghost: 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent',
  }[variant];

  return (
    <button
      className={`${base} ${sizeClasses} ${variantClasses} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg
          className="animate-spin -ml-0.5 h-3.5 w-3.5 text-current shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
};
