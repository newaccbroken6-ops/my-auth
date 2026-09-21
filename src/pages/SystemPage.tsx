import { useEffect, useState } from 'react';
import { api, SystemStats } from '../lib/api';
import {
  Database, HardDrive, Clock, Users,
  Zap, Gauge, BarChart3, RefreshCw
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip
} from 'recharts';

export default function SystemPage() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function loadStats() {
    try {
      const data = await api.getSystemStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load system stats:', error);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadStats();
  };

  const db = stats?.database;
  const perf = stats?.performance;
  const usage = stats?.usage;
  const growth = stats?.growth;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Gauge className="w-6 h-6 text-cyan-400" />
            System & Database Diagnostics
          </h1>
          <p className="text-gray-400 mt-1">Neon PostgreSQL health, storage usage, and metrics</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-300 hover:text-white hover:border-gray-700 transition-colors disabled:opacity-50 text-sm font-medium self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-cyan-400' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400 text-xs font-medium uppercase">Neon Database</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Database className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{db?.totalRows.toLocaleString() ?? '0'}</p>
          <p className="text-gray-500 text-xs mt-1">Total database records</p>
        </div>

        <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400 text-xs font-medium uppercase">Query Latency</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{perf?.avgQueryTime ?? 0} ms</p>
          <p className="text-gray-500 text-xs mt-1">Neon DB query roundtrip</p>
        </div>

        <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400 text-xs font-medium uppercase">Total Users</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Users className="w-4 h-4 text-purple-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{usage?.totalUsers ?? 0}</p>
          <p className="text-gray-500 text-xs mt-1">+{growth?.usersThisWeek ?? 0} this week</p>
        </div>

        <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400 text-xs font-medium uppercase">Uptime</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Clock className="w-4 h-4 text-blue-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{perf?.uptime ?? '0m'}</p>
          <p className="text-gray-500 text-xs mt-1">API process active</p>
        </div>
      </div>

      {/* Database Storage Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gray-900/40 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                <HardDrive className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-white font-bold text-lg">Neon DB Tables & Storage</h2>
                <p className="text-gray-500 text-xs">Table sizes and row count distributions</p>
              </div>
            </div>
            <span className="text-xs px-3 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full font-mono">
              PostgreSQL 18
            </span>
          </div>

          <div className="space-y-3">
            {(db?.tables ?? []).map(table => (
              <div key={table.name} className="flex items-center justify-between p-3 rounded-xl bg-gray-800/40 border border-gray-700/30">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-white text-sm font-medium">{table.name}</span>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <span className="text-gray-400 font-mono">{table.rows} rows</span>
                  <span className="text-cyan-400 font-mono font-medium">{table.size}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 24h Hourly Activity Chart */}
        <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">24h Traffic</h2>
              <p className="text-gray-500 text-xs">Hourly API requests</p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats?.recentActivity ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="hour" stroke="#4b5563" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis stroke="#4b5563" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
