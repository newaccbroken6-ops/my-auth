import { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default';
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
  pulse?: boolean;
}

export function Badge({ children, variant = 'default', icon: Icon, className = '', pulse = false }: BadgeProps) {
  const variants = {
    success: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    warning: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    error: 'text-red-400 bg-red-500/10 border-red-500/30',
    info: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    default: 'text-gray-400 bg-gray-500/10 border-gray-500/30',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${variants[variant]} ${className}`}
    >
      {Icon && <Icon className={`w-3.5 h-3.5 ${pulse ? 'animate-pulse' : ''}`} />}
      {children}
    </span>
  );
}
