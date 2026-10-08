import React from 'react';

export interface StatusBadgeProps {
  status:
    'connected' | 'in-memory-fallback' | 'disconnected' | 'ok' | 'error' | 'warning' | 'degraded';
  label?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  const displayLabel = label || status;

  let colorClasses = 'bg-slate-800 text-slate-300 border-slate-700';
  let indicatorColor = 'bg-slate-400';

  if (status === 'connected' || status === 'ok') {
    colorClasses = 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80';
    indicatorColor = 'bg-emerald-400';
  } else if (status === 'in-memory-fallback' || status === 'warning' || status === 'degraded') {
    colorClasses = 'bg-amber-950/60 text-amber-300 border-amber-800/80';
    indicatorColor = 'bg-amber-400';
  } else if (status === 'disconnected' || status === 'error') {
    colorClasses = 'bg-rose-950/60 text-rose-300 border-rose-800/80';
    indicatorColor = 'bg-rose-400';
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${colorClasses}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${indicatorColor}`} />
      <span className="capitalize">{displayLabel}</span>
    </span>
  );
};

export interface CardProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ title, description, children, className = '' }) => {
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-lg p-4 ${className}`}>
      {title && <h3 className="text-sm font-semibold text-slate-100 mb-1">{title}</h3>}
      {description && <p className="text-xs text-slate-400 mb-3">{description}</p>}
      <div>{children}</div>
    </div>
  );
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) => {
  const base =
    'inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:pointer-events-none rounded-md';

  const sizeClasses = {
    sm: 'text-xs px-2.5 py-1.5 h-8',
    md: 'text-xs px-3.5 py-2 h-9',
    lg: 'text-sm px-4 py-2.5 h-10',
  }[size];

  const variantClasses = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700',
    secondary: 'bg-slate-800 text-slate-200 hover:bg-slate-700 active:bg-slate-800 border border-slate-700',
    outline: 'border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white',
    danger: 'bg-rose-600/20 text-rose-300 hover:bg-rose-600 hover:text-white border border-rose-600/40',
  }[variant];

  return (
    <button className={`${base} ${sizeClasses} ${variantClasses} ${className}`} {...props}>
      {children}
    </button>
  );
};
