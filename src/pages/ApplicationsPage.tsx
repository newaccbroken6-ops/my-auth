import { useEffect, useState } from 'react';
import { api, Application } from '../lib/api';
import {
  Plus, AppWindow, Copy, Check, ToggleLeft, ToggleRight,
  X, Loader2, Eye, EyeOff
} from 'lucide-react';

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export default function ApplicationsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', version: '1.0.0' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  async function load() {
    try {
      const data = await api.getApplications();
      setApps(data ?? []);
    } catch (err) {
      console.error('Failed to load applications:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createApp() {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await api.createApplication({
        name: form.name.trim(),
        description: form.description.trim() || null,
        version: form.version.trim() || '1.0.0',
      });
      setShowCreate(false);
      setForm({ name: '', description: '', version: '1.0.0' });
      load();
    } catch (err: any) {
      setError(err.message || 'Failed to create application');
    } finally {
      setSaving(false);
    }
  }

  async function toggleApp(app: Application) {
    try {
      await api.updateApplication(app.id, { is_active: !app.is_active });
      load();
    } catch (err) {
      console.error('Failed to toggle application:', err);
    }
  }

  async function copyToClipboard(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Applications</h1>
          <p className="text-gray-400 mt-1">Manage your licensed applications</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium text-sm hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/20"
        >
          <Plus className="w-4 h-4" />
          New App
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-48 bg-gray-900/60 border border-gray-800 rounded-2xl animate-pulse" />)}
        </div>
      ) : apps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-800/80 border border-gray-700 flex items-center justify-center mb-4">
            <AppWindow className="w-8 h-8 text-gray-600" />
          </div>
          <p className="text-gray-400 font-medium">No applications yet</p>
          <p className="text-gray-500 text-sm mt-1">Create your first app to start generating licenses</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {apps.map(app => (
            <div key={app.id} className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/20 flex items-center justify-center">
                    <AppWindow className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">{app.name}</h3>
                    <span className="text-gray-500 text-xs">v{app.version}</span>
                  </div>
                </div>
                <button
                  onClick={() => toggleApp(app)}
                  className={`transition-colors ${app.is_active ? 'text-cyan-400 hover:text-cyan-300' : 'text-gray-600 hover:text-gray-400'}`}
                >
                  {app.is_active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                </button>
              </div>

              {app.description && (
                <p className="text-gray-400 text-sm mb-4">{app.description}</p>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between bg-gray-800/60 rounded-xl px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-gray-500 text-xs mb-0.5">App ID</p>
                    <p className="text-gray-300 text-xs font-mono truncate">{app.id}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(app.id, `id-${app.id}`)}
                    className="ml-2 text-gray-400 hover:text-cyan-400 transition-colors flex-shrink-0"
                  >
                    {copiedId === `id-${app.id}` ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex items-center justify-between bg-gray-800/60 rounded-xl px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-gray-500 text-xs mb-0.5">API Secret</p>
                    <p className="text-gray-300 text-xs font-mono truncate">
                      {revealedSecret === app.id ? app.api_secret : '••••••••••••••••••••••••'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <button
                      onClick={() => setRevealedSecret(revealedSecret === app.id ? null : app.id)}
                      className="text-gray-400 hover:text-cyan-400 transition-colors"
                    >
                      {revealedSecret === app.id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => copyToClipboard(app.api_secret, `secret-${app.id}`)}
                      className="text-gray-400 hover:text-cyan-400 transition-colors"
                    >
                      {copiedId === `secret-${app.id}` ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800">
                <span className={`text-xs px-2 py-1 rounded-lg font-medium ${
                  app.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-gray-800 text-gray-500 border border-gray-700'
                }`}>
                  {app.is_active ? 'Active' : 'Inactive'}
                </span>
                <span className="text-gray-500 text-xs">
                  {new Date(app.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <Modal title="Create Application" onClose={() => setShowCreate(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">App Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="My Application"
                className="w-full bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description..."
                rows={3}
                className="w-full bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors resize-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Version</label>
              <input
                type="text"
                value={form.version}
                onChange={e => setForm({ ...form, version: e.target.value })}
                placeholder="1.0.0"
                className="w-full bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white transition-colors text-sm">
                Cancel
              </button>
              <button
                onClick={createApp}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium text-sm hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Create
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
