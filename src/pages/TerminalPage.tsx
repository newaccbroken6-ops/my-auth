import { useEffect, useState, useRef } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Terminal, WifiOff, Server, Database, Activity, AlertCircle, CheckCircle2 } from 'lucide-react';

interface TerminalLine {
  type: 'info' | 'success' | 'error' | 'warning' | 'command';
  text: string;
  timestamp: string;
}

interface PingStats {
  database: { status: 'connected' | 'disconnected'; ping: number | null };
  api: { status: 'connected' | 'disconnected'; ping: number | null };
}

export default function TerminalPage() {
  const { profile } = useAuth();
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [pingStats, setPingStats] = useState<PingStats>({
    database: { status: 'disconnected', ping: null },
    api: { status: 'disconnected', ping: null },
  });
  const [autoPing, setAutoPing] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const addLine = (type: TerminalLine['type'], text: string) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLines(prev => [...prev, { type, text, timestamp }]);
  };

  const scrollToBottom = () => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [lines]);

  useEffect(() => {
    addLine('info', 'SUPER NOVA Terminal v2.0.0 (Neon PostgreSQL Edition)');
    addLine('info', 'Type "help" for available commands');
    addLine('info', '================================');
    pingDatabase();
    pingAPI();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (autoPing) {
      intervalRef.current = setInterval(() => {
        pingDatabase();
        pingAPI();
      }, 5000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoPing]);

  const pingDatabase = async () => {
    const start = Date.now();
    try {
      const res = await api.pingDatabase();
      const ping = res.ping !== undefined ? res.ping : Date.now() - start;
      setPingStats(prev => ({ ...prev, database: { status: 'connected', ping } }));
      addLine('success', `DATABASE: Neon PostgreSQL Connected - Ping: ${ping}ms`);
    } catch (err: any) {
      setPingStats(prev => ({ ...prev, database: { status: 'disconnected', ping: null } }));
      addLine('error', `DATABASE: Connection error - ${err.message || err}`);
    }
  };

  const pingAPI = async () => {
    const start = Date.now();
    try {
      const res = await fetch('/api/health');
      const ping = Date.now() - start;
      if (res.ok) {
        setPingStats(prev => ({ ...prev, api: { status: 'connected', ping } }));
        addLine('success', `API: Connected - Ping: ${ping}ms`);
      } else {
        setPingStats(prev => ({ ...prev, api: { status: 'disconnected', ping: null } }));
        addLine('error', `API: Connection failed - Status: ${res.status}`);
      }
    } catch (err: any) {
      setPingStats(prev => ({ ...prev, api: { status: 'disconnected', ping: null } }));
      addLine('error', `API: Connection error - ${err.message || err}`);
    }
  };

  const handleCommand = (cmd: string) => {
    const command = cmd.trim().toLowerCase();
    addLine('command', `> ${cmd}`);

    const host = window.location.origin;

    switch (command) {
      case 'help':
        addLine('info', 'Available commands:');
        addLine('info', '  ping db    - Test Neon database connection');
        addLine('info', '  ping api   - Test REST API connection');
        addLine('info', '  ping all   - Test all connections');
        addLine('info', '  auto on    - Enable auto-ping (every 5s)');
        addLine('info', '  auto off   - Disable auto-ping');
        addLine('info', '  clear      - Clear terminal');
        addLine('info', '  status     - Show connection status');
        addLine('info', '  dbinfo     - Show database & API location');
        break;

      case 'dbinfo':
        addLine('info', '========================================');
        addLine('info', '   NEON POSTGRESQL & API ENDPOINTS');
        addLine('info', '========================================');
        addLine('success', `Host: ${host}`);
        addLine('info', `Database Engine: Neon Serverless PostgreSQL`);
        addLine('info', '');
        addLine('info', '=== REST API ENDPOINTS ===');
        addLine('success', `Validate License: ${host}/api/v1/validate-license`);
        addLine('success', `Reset HWID:       ${host}/api/hwid/reset`);
        addLine('success', `Latest Version:   ${host}/api/v1/latest-version`);
        addLine('success', `Bulk Licenses:    ${host}/api/licenses/bulk`);
        addLine('success', `Health Status:    ${host}/api/health`);
        addLine('info', '');
        addLine('info', '=== POSTGRESQL TABLES ===');
        addLine('info', '• profiles (users)');
        addLine('info', '• applications');
        addLine('info', '• licenses');
        addLine('info', '• hwid_bindings');
        addLine('info', '• activity_logs');
        addLine('info', '• app_versions');
        addLine('info', '• rate_limit_log');
        addLine('info', '========================================');
        break;

      case 'ping db':
        pingDatabase();
        break;

      case 'ping api':
        pingAPI();
        break;

      case 'ping all':
        addLine('info', 'Pinging all services...');
        pingDatabase();
        setTimeout(() => pingAPI(), 300);
        break;

      case 'auto on':
        setAutoPing(true);
        addLine('success', 'Auto-ping enabled (every 5 seconds)');
        break;

      case 'auto off':
        setAutoPing(false);
        addLine('warning', 'Auto-ping disabled');
        break;

      case 'clear':
        setLines([]);
        addLine('info', 'Terminal cleared');
        break;

      case 'status':
        addLine('info', '=== Connection Status ===');
        addLine(
          pingStats.database.status === 'connected' ? 'success' : 'error',
          `DATABASE: ${pingStats.database.status.toUpperCase()} ${
            pingStats.database.ping !== null ? `(${pingStats.database.ping}ms)` : ''
          }`
        );
        addLine(
          pingStats.api.status === 'connected' ? 'success' : 'error',
          `API: ${pingStats.api.status.toUpperCase()} ${
            pingStats.api.ping !== null ? `(${pingStats.api.ping}ms)` : ''
          }`
        );
        break;

      default:
        addLine('error', `Unknown command: ${cmd}`);
        addLine('info', 'Type "help" for available commands');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const input = e.currentTarget;
      if (input.value.trim()) {
        handleCommand(input.value);
        input.value = '';
      }
    }
  };

  if (profile?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
        <p className="text-gray-400">This page is only accessible to administrators.</p>
      </div>
    );
  }

  const getLineColor = (type: TerminalLine['type']) => {
    switch (type) {
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'warning': return 'text-yellow-400';
      case 'command': return 'text-cyan-400';
      default: return 'text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Terminal className="w-8 h-8 text-green-400" />
          System Terminal
        </h1>
        <p className="text-gray-400 mt-1">Real-time connection monitoring and diagnostics</p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Database Status */}
        <div className={`bg-black border-2 rounded-2xl p-6 transition-all ${
          pingStats.database.status === 'connected' 
            ? 'border-green-500/50 shadow-lg shadow-green-500/20' 
            : 'border-red-500/50 shadow-lg shadow-red-500/20'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                pingStats.database.status === 'connected' 
                  ? 'bg-green-500/20' 
                  : 'bg-red-500/20'
              }`}>
                <Database className={`w-6 h-6 ${
                  pingStats.database.status === 'connected' 
                    ? 'text-green-400' 
                    : 'text-red-400'
                }`} />
              </div>
              <div>
                <p className="text-white font-bold text-lg">NEON POSTGRESQL</p>
                <p className={`text-sm font-mono ${
                  pingStats.database.status === 'connected' 
                    ? 'text-green-400' 
                    : 'text-red-400'
                }`}>
                  {pingStats.database.status.toUpperCase()}
                </p>
              </div>
            </div>
            {pingStats.database.status === 'connected' ? (
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            ) : (
              <WifiOff className="w-8 h-8 text-red-400" />
            )}
          </div>
          {pingStats.database.ping !== null && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <p className="text-gray-400 text-sm">Latency</p>
              <p className="text-2xl font-bold text-white font-mono">
                {pingStats.database.ping}ms
              </p>
            </div>
          )}
        </div>

        {/* API Status */}
        <div className={`bg-black border-2 rounded-2xl p-6 transition-all ${
          pingStats.api.status === 'connected' 
            ? 'border-green-500/50 shadow-lg shadow-green-500/20' 
            : 'border-red-500/50 shadow-lg shadow-red-500/20'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                pingStats.api.status === 'connected' 
                  ? 'bg-green-500/20' 
                  : 'bg-red-500/20'
              }`}>
                <Server className={`w-6 h-6 ${
                  pingStats.api.status === 'connected' 
                    ? 'text-green-400' 
                    : 'text-red-400'
                }`} />
              </div>
              <div>
                <p className="text-white font-bold text-lg">REST API SERVER</p>
                <p className={`text-sm font-mono ${
                  pingStats.api.status === 'connected' 
                    ? 'text-green-400' 
                    : 'text-red-400'
                }`}>
                  {pingStats.api.status.toUpperCase()}
                </p>
              </div>
            </div>
            {pingStats.api.status === 'connected' ? (
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            ) : (
              <WifiOff className="w-8 h-8 text-red-400" />
            )}
          </div>
          {pingStats.api.ping !== null && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <p className="text-gray-400 text-sm">Latency</p>
              <p className="text-2xl font-bold text-white font-mono">
                {pingStats.api.ping}ms
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Terminal */}
      <div className="bg-black border-2 border-green-500/30 rounded-2xl overflow-hidden shadow-2xl shadow-green-500/10">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-900/50 border-b border-green-500/20">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="ml-3 text-gray-400 text-sm font-mono">admin@supernova-neon</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className={`w-4 h-4 ${autoPing ? 'text-green-400 animate-pulse' : 'text-gray-600'}`} />
            <span className="text-xs text-gray-500 font-mono">
              {autoPing ? 'AUTO-PING ON' : 'AUTO-PING OFF'}
            </span>
          </div>
        </div>

        <div
          ref={terminalRef}
          className="h-96 overflow-y-auto p-4 font-mono text-sm scrollbar-thin scrollbar-thumb-green-500/20 scrollbar-track-transparent"
        >
          {lines.map((line, i) => (
            <div key={i} className="flex items-start gap-2 mb-1">
              <span className="text-gray-600 text-xs">[{line.timestamp}]</span>
              <span className={getLineColor(line.type)}>{line.text}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-green-400">$</span>
            <input
              type="text"
              onKeyPress={handleKeyPress}
              placeholder="Type command..."
              className="flex-1 bg-transparent text-green-400 outline-none placeholder-green-800"
              autoFocus
            />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={() => handleCommand('ping db')}
          className="px-4 py-3 rounded-xl bg-black border-2 border-cyan-500/30 text-cyan-400 hover:border-cyan-500 hover:bg-cyan-500/10 transition-all font-mono text-sm"
        >
          Ping DB
        </button>
        <button
          onClick={() => handleCommand('ping api')}
          className="px-4 py-3 rounded-xl bg-black border-2 border-purple-500/30 text-purple-400 hover:border-purple-500 hover:bg-purple-500/10 transition-all font-mono text-sm"
        >
          Ping API
        </button>
        <button
          onClick={() => handleCommand('ping all')}
          className="px-4 py-3 rounded-xl bg-black border-2 border-green-500/30 text-green-400 hover:border-green-500 hover:bg-green-500/10 transition-all font-mono text-sm"
        >
          Ping All
        </button>
        <button
          onClick={() => handleCommand(autoPing ? 'auto off' : 'auto on')}
          className={`px-4 py-3 rounded-xl bg-black border-2 transition-all font-mono text-sm ${
            autoPing
              ? 'border-yellow-500/30 text-yellow-400 hover:border-yellow-500 hover:bg-yellow-500/10'
              : 'border-gray-500/30 text-gray-400 hover:border-gray-500 hover:bg-gray-500/10'
          }`}
        >
          {autoPing ? 'Auto OFF' : 'Auto ON'}
        </button>
      </div>
    </div>
  );
}
