import React from 'react';

export interface StatusBadgeProps {
  status:
    'connected' | 'in-memory-fallback' | 'disconnected' | 'ok' | 'error' | 'warning' | 'degraded';
  label?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  const displayLabel = label || status;

  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-300';
  let indicatorColor = 'bg-slate-400';

  if (status === 'connected' || status === 'ok') {
    colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-300';
    indicatorColor = 'bg-emerald-500';
  } else if (status === 'in-memory-fallback' || status === 'warning' || status === 'degraded') {
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-300';
    indicatorColor = 'bg-amber-500';
  } else if (status === 'disconnected' || status === 'error') {
    colorClasses = 'bg-rose-50 text-rose-700 border-rose-300';
    indicatorColor = 'bg-rose-500';
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${colorClasses}`}
    >
      <span className={`w-2 h-2 rounded-full ${indicatorColor}`} />
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
    <div className={`bg-white border border-slate-200 rounded-lg p-5 shadow-sm ${className}`}>
      {title && <h3 className="text-base font-semibold text-slate-900 mb-1">{title}</h3>}
      {description && <p className="text-xs text-slate-500 mb-4">{description}</p>}
      <div>{children}</div>
    </div>
  );
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
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
    'inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none rounded-md';

  const sizeClasses = {
    sm: 'text-xs px-3 py-1.5',
    md: 'text-sm px-4 py-2',
    lg: 'text-base px-5 py-2.5',
  }[size];

  const variantClasses = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500',
    secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200 focus:ring-slate-400',
    outline: 'border border-slate-300 text-slate-700 hover:bg-slate-50 focus:ring-slate-400',
  }[variant];

  return (
    <button className={`${base} ${sizeClasses} ${variantClasses} ${className}`} {...props}>
      {children}
    </button>
  );
};
