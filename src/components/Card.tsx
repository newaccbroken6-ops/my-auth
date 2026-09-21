import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
}

export function Card({ children, className = '', hover = false, glow = false }: CardProps) {
  return (
    <div
      className={`bg-gray-900/40 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 transition-all duration-300 ${
        hover ? 'hover:border-gray-700 hover:shadow-xl hover:scale-105' : ''
      } ${glow ? 'glow-cyan' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  subtitle?: string;
  trend?: string;
  trendUp?: boolean;
}

export function StatCard({ label, value, icon: Icon, gradient, subtitle, trend, trendUp }: StatCardProps) {
  return (
    <div className="group relative bg-gray-900/40 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-all duration-300 hover:scale-105 hover:shadow-xl overflow-hidden slide-up">
      {/* Gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient}/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-gray-400 text-sm font-medium mb-1">{label}</p>
            <p className="text-4xl font-bold text-white">{typeof value === 'number' ? value.toLocaleString() : value}</p>
            {subtitle && <p className="text-gray-500 text-xs mt-1">{subtitle}</p>}
          </div>
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>

        {trend && (
          <div className="flex items-center justify-between">
            <p className="text-gray-500 text-xs">{subtitle}</p>
            <div className={`flex items-center gap-1 text-xs font-medium ${trendUp ? 'text-emerald-400' : 'text-gray-500'}`}>
              {trend}
            </div>
          </div>
        )}
      </div>

      {/* Decorative corner accent */}
      <div className={`absolute -bottom-2 -right-2 w-20 h-20 bg-gradient-to-br ${gradient} rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity`} />
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle: string;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, icon: Icon, actions }: PageHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 border border-cyan-500/20 p-8 mb-6 slide-up">
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-transparent to-purple-500/5 pointer-events-none" />
      <div className="relative z-10 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            {Icon && <Icon className="w-8 h-8 text-cyan-400 animate-pulse" />}
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500">
              {title}
            </h1>
          </div>
          <p className="text-gray-400 text-lg">{subtitle}</p>
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
      {/* Animated background blobs */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
    </div>
  );
}
