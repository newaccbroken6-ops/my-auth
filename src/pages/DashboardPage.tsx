import { useEffect, useState } from 'react';
import { api, DashboardStats } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Key, AppWindow, Activity, TrendingUp,
  CheckCircle2, Clock, Ban, ArrowUp, ArrowDown, Sparkles
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

export default function DashboardPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getDashboardStats();
        setStats(data);
      } catch (err) {
        console.error('Failed to load dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const statCards = stats ? [
    { 
      label: 'Total Licenses', 
      value: stats.totalLicenses, 
      icon: Key, 
      color: 'cyan', 
      sub: 'All time',
      trend: '+12%',
      trendUp: true,
      gradient: 'from-cyan-500/20 to-blue-500/20',
      iconBg: 'from-cyan-500 to-blue-600'
    },
    { 
      label: 'Active', 
      value: stats.activeLicenses, 
      icon: CheckCircle2, 
      color: 'emerald', 
      sub: 'Currently valid',
      trend: '+8%',
      trendUp: true,
      gradient: 'from-emerald-500/20 to-green-500/20',
      iconBg: 'from-emerald-500 to-green-600'
    },
    { 
      label: 'Expired', 
      value: stats.expiredLicenses, 
      icon: Clock, 
      color: 'gray', 
      sub: 'Past due',
      trend: '-3%',
      trendUp: false,
      gradient: 'from-gray-500/20 to-slate-500/20',
      iconBg: 'from-gray-500 to-slate-600'
    },
    { 
      label: 'Applications', 
      value: stats.totalApps, 
      icon: AppWindow, 
      color: 'blue', 
      sub: 'Registered apps',
      trend: '+2',
      trendUp: true,
      gradient: 'from-blue-500/20 to-indigo-500/20',
      iconBg: 'from-blue-500 to-indigo-600'
    },
    { 
      label: 'Banned', 
      value: stats.bannedLicenses, 
      icon: Ban, 
      color: 'red', 
      sub: 'Revoked',
      trend: '0%',
      trendUp: false,
      gradient: 'from-red-500/20 to-rose-500/20',
      iconBg: 'from-red-500 to-rose-600'
    },
    { 
      label: 'API Calls', 
      value: stats.totalLogs, 
      icon: Activity, 
      color: 'violet', 
      sub: 'Total events',
      trend: '+24%',
      trendUp: true,
      gradient: 'from-violet-500/20 to-purple-500/20',
      iconBg: 'from-violet-500 to-purple-600'
    },
  ] : [];

  return (
    <div className="space-y-6 relative">
      {/* Header with gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 border border-cyan-500/20 p-8">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-transparent to-purple-500/5 pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-6 h-6 text-cyan-400 animate-pulse" />
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500">
              Welcome back, {profile?.username ?? 'User'}!
            </h1>
          </div>
          <p className="text-gray-400 text-lg">Here's what's happening with your licenses today</p>
        </div>
        {/* Animated background blobs */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Stat cards with enhanced design */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 relative">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 animate-pulse h-36" />
            ))
          : statCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <div 
                  key={card.label} 
                  className="group relative bg-gray-900/40 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-all duration-300 hover:scale-105 hover:shadow-xl overflow-hidden"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Gradient overlay */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />
                  
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-gray-400 text-sm font-medium mb-1">{card.label}</p>
                        <p className="text-4xl font-bold text-white">{card.value.toLocaleString()}</p>
                      </div>
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.iconBg} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <p className="text-gray-500 text-xs">{card.sub}</p>
                      <div className={`flex items-center gap-1 text-xs font-medium ${card.trendUp ? 'text-emerald-400' : 'text-gray-500'}`}>
                        {card.trendUp ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                        {card.trend}
                      </div>
                    </div>
                  </div>
                  
                  {/* Decorative corner accent */}
                  <div className={`absolute -bottom-2 -right-2 w-20 h-20 bg-gradient-to-br ${card.iconBg} rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity`} />
                </div>
              );
            })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
        {/* Area chart with enhanced styling */}
        <div className="lg:col-span-2 bg-gray-900/40 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-all">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">API Activity</h2>
              <p className="text-gray-500 text-xs">Last 7 days performance</p>
            </div>
          </div>
          {loading ? (
            <div className="h-64 animate-pulse bg-gray-800/50 rounded-xl" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={stats?.recentLogs ?? []}>
                <defs>
                  <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis 
                  dataKey="date" 
                  stroke="#4b5563" 
                  tick={{ fill: '#9ca3af', fontSize: 12 }} 
                  tickLine={false}
                />
                <YAxis 
                  stroke="#4b5563" 
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ 
                    background: 'rgba(17, 24, 39, 0.95)', 
                    border: '1px solid #374151', 
                    borderRadius: 12, 
                    color: '#f9fafb',
                    backdropFilter: 'blur(8px)'
                  }}
                  labelStyle={{ color: '#9ca3af', fontWeight: 'bold' }}
                  cursor={{ stroke: '#06b6d4', strokeWidth: 1, strokeDasharray: '5 5' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#06b6d4" 
                  fill="url(#actGrad)" 
                  strokeWidth={3}
                  dot={{ fill: '#06b6d4', r: 4 }}
                  activeDot={{ r: 6, fill: '#06b6d4' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie chart with enhanced styling */}
        <div className="bg-gray-900/40 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-all">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Key className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">License Status</h2>
              <p className="text-gray-500 text-xs">Distribution overview</p>
            </div>
          </div>
          {loading ? (
            <div className="h-64 animate-pulse bg-gray-800/50 rounded-xl" />
          ) : stats?.statusBreakdown.length ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={stats.statusBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    dataKey="value"
                    strokeWidth={3}
                    stroke="#111827"
                  >
                    {stats.statusBreakdown.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ 
                      background: 'rgba(17, 24, 39, 0.95)', 
                      border: '1px solid #374151', 
                      borderRadius: 12, 
                      color: '#f9fafb',
                      backdropFilter: 'blur(8px)'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2.5 mt-6">
                {stats.statusBreakdown.map(s => (
                  <div key={s.name} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-800/40 hover:bg-gray-800/60 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full shadow-lg" style={{ background: s.color }} />
                      <span className="text-gray-300 text-sm font-medium">{s.name}</span>
                    </div>
                    <span className="text-white font-bold text-sm">{s.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-gray-500">
              <Key className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">No license data yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
