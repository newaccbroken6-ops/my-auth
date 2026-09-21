import { useEffect, useState } from 'react';
import { api, MonitorStats } from '../lib/api';
import {
  Monitor, Activity, Clock, Key, AlertCircle,
  TrendingUp, Users, RefreshCw, Shield, Zap
} from 'lucide-react';

export default function MonitorPage() {
  const [data, setData] = useState<MonitorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadData() {
    try {
      const stats = await api.getMonitorStats();
      setData(stats);
    } catch (error) {
      console.error('Failed to load monitoring data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
    // Auto-refresh every 10 seconds
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const apps = data?.apps ?? [];
  const liveActivity = data?.liveActivity ?? [];

  const totalApiCallsToday = apps.reduce((sum, app) => sum + app.api_calls_today, 0);
  const totalActiveLicenses = apps.reduce((sum, app) => sum + app.active_licenses, 0);
  const totalUniqueUsers = apps.reduce((sum, app) => sum + app.unique_hwids, 0);

  const getEventBadge = (eventType: string) => {
    switch (eventType) {
      case 'validate_success':
        return <span className="text-xs px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1"><Zap className="w-3 h-3" /> Validated</span>;
      case 'invalid_key':
        return <span className="text-xs px-2 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Invalid Key</span>;
      case 'expired':
        return <span className="text-xs px-2 py-1 rounded-lg bg-gray-500/10 text-gray-400 border border-gray-500/20 flex items-center gap-1"><Clock className="w-3 h-3" /> Expired</span>;
      case 'hwid_mismatch':
        return <span className="text-xs px-2 py-1 rounded-lg bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 flex items-center gap-1"><Shield className="w-3 h-3" /> HWID Mismatch</span>;
      default:
        return <span className="text-xs px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">{eventType}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Monitor className="w-6 h-6 text-cyan-400" />
            Live Monitor
          </h1>
          <p className="text-gray-400 mt-1">Real-time application activity & metrics</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-300 hover:text-white hover:border-gray-700 transition-colors disabled:opacity-50 text-sm font-medium self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-cyan-400' : ''}`} />
          {refreshing ? 'Updating...' : 'Refresh'}
        </button>
      </div>

      {/* Top Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">API Calls Today</p>
              <p className="text-3xl font-bold text-white mt-1">{totalApiCallsToday.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Activity className="w-6 h-6 text-cyan-400" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 text-xs text-emerald-400">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Active monitoring running</span>
          </div>
        </div>

        <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">Active Licenses</p>
              <p className="text-3xl font-bold text-white mt-1">{totalActiveLicenses.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Key className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 text-xs text-gray-400">
            <span>Across all registered applications</span>
          </div>
        </div>

        <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">Unique Devices (24h)</p>
              <p className="text-3xl font-bold text-white mt-1">{totalUniqueUsers.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-400" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 text-xs text-gray-400">
            <span>Active HWID fingerprints</span>
          </div>
        </div>
      </div>

      {/* Applications Activity Grid */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-white">Application Health & Metrics</h2>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map(i => <div key={i} className="h-40 bg-gray-900/60 border border-gray-800 rounded-2xl animate-pulse" />)}
          </div>
        ) : apps.length === 0 ? (
          <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-8 text-center text-gray-500">
            No applications registered yet
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {apps.map(app => (
              <div key={app.app_id} className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-white font-bold text-base flex items-center gap-2">
                      {app.app_name}
                      <span className={`w-2 h-2 rounded-full ${app.is_active ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                    </h3>
                    <p className="text-gray-500 text-xs mt-0.5">Owner: {app.owner}</p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${
                    app.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-gray-800 text-gray-500 border-gray-700'
                  }`}>
                    {app.is_active ? 'Active' : 'Disabled'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 p-3 bg-gray-800/40 rounded-xl mb-3 text-center">
                  <div>
                    <p className="text-gray-500 text-xs">Active Keys</p>
                    <p className="text-white font-bold text-sm mt-0.5">{app.active_licenses} / {app.total_licenses}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Calls (24h)</p>
                    <p className="text-cyan-400 font-bold text-sm mt-0.5">{app.api_calls_today}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Devices</p>
                    <p className="text-purple-400 font-bold text-sm mt-0.5">{app.unique_hwids}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Last Activity:</span>
                  <span className="text-gray-400 font-mono">
                    {app.last_activity ? new Date(app.last_activity).toLocaleTimeString() : 'No recent calls'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live Stream Logs */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-400 animate-pulse" />
          Live Validation Stream
        </h2>
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-800/50">
            {loading ? (
              <div className="p-8 text-center text-gray-500 animate-pulse">Loading live activity stream...</div>
            ) : liveActivity.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No recent activity detected</div>
            ) : (
              liveActivity.map(event => (
                <div key={event.id} className="p-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div>{getEventBadge(event.event_type)}</div>
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{event.app_name}</p>
                      <p className="text-gray-500 text-xs font-mono truncate">
                        IP: {event.ip_address || '—'} | HWID: {event.hwid ? `${event.hwid.slice(0, 8)}...` : '—'}
                      </p>
                    </div>
                  </div>
                  <span className="text-gray-500 text-xs font-mono flex-shrink-0 ml-4">
                    {new Date(event.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
