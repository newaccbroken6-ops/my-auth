import { useEffect, useState } from 'react';
import { api, Application, AppVersion } from '../lib/api';
import {
  Upload, Plus, X, Loader2, Check, Copy, Tag,
  Download, Trash2
} from 'lucide-react';

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl shadow-black/50">
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

export default function UpdatesPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<string>('');
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({
    version: '',
    download_url: '',
    changelog: '',
    force_update: false,
  });

  useEffect(() => {
    api.getApplications().then(data => {
      setApps(data ?? []);
      if (data && data.length > 0) setSelectedApp(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedApp) return;
    loadVersions();
  }, [selectedApp]);

  async function loadVersions() {
    setLoading(true);
    try {
      const data = await api.getVersions(selectedApp);
      setVersions(data ?? []);
    } catch (err) {
      console.error('Failed to load versions:', err);
    } finally {
      setLoading(false);
    }
  }

  async function copy(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  async function createVersion() {
    if (!form.version.trim()) { setError('Version is required'); return; }
    if (!form.download_url.trim()) { setError('Download URL is required'); return; }
    setSaving(true); setError('');

    try {
      await api.createVersion({
        app_id: selectedApp,
        version: form.version.trim(),
        download_url: form.download_url.trim(),
        changelog: form.changelog.trim() || undefined,
        is_latest: true,
        force_update: form.force_update,
      });
      setShowCreate(false);
      setForm({ version: '', download_url: '', changelog: '', force_update: false });
      loadVersions();
    } catch (err: any) {
      setError(err.message || 'Failed to create version');
    } finally {
      setSaving(false);
    }
  }

  async function setLatest(id: string) {
    try {
      await api.updateVersion(id, { is_latest: true });
      loadVersions();
    } catch (err) {
      console.error('Failed to set latest version:', err);
    }
  }

  async function deleteVersion(id: string) {
    if (!confirm('Are you sure you want to delete this version?')) return;
    try {
      await api.deleteVersion(id);
      loadVersions();
    } catch (err) {
      console.error('Failed to delete version:', err);
    }
  }

  const endpointUrl = selectedApp
    ? `${window.location.origin}/api/v1/latest-version?app_id=${selectedApp}`
    : '';

  const cppSnippet = selectedApp ? `// In your C++ loader — fetch latest version from SUPER NOVA KEYS
// GET ${endpointUrl}
//
// Response JSON:
// { "version": "V1.9", "download_url": "...", "changelog": "...", "force_update": false }

const std::string CURRENT_VERSION = "V1.0.0";

void checkForUpdates() {
    cpr::Response r = cpr::Get(cpr::Url{"${endpointUrl}"});
    if (r.status_code == 200) {
        auto j = nlohmann::json::parse(r.text);
        std::string latestVer = j["version"].get<std::string>();
        std::string downloadUrl = j["download_url"].get<std::string>();
        bool forceUpdate = j.value("force_update", false);

        if (latestVer != CURRENT_VERSION) {
            std::cout << "Update available: " << latestVer << std::endl;
            // Download from downloadUrl
        }
    }
}` : '';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Upload className="w-6 h-6 text-cyan-400" />
            App Versions & Auto-Updates
          </h1>
          <p className="text-gray-400 mt-1">Manage downloadable binary updates and versions</p>
        </div>
        {selectedApp && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium text-sm hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/20"
          >
            <Plus className="w-4 h-4" />
            Release New Version
          </button>
        )}
      </div>

      {apps.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm">Select Application:</span>
          <select
            value={selectedApp}
            onChange={e => setSelectedApp(e.target.value)}
            className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
          >
            {apps.map(a => (
              <option key={a.id} value={a.id}>{a.name} (v{a.version})</option>
            ))}
          </select>
        </div>
      )}

      {selectedApp && (
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-gray-400 text-xs mb-1">Public Update Check Endpoint (C++ Clients)</p>
            <p className="text-cyan-400 font-mono text-xs truncate">{endpointUrl}</p>
          </div>
          <button
            onClick={() => copy(endpointUrl, 'endpoint')}
            className="ml-3 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs flex items-center gap-1.5 transition-colors flex-shrink-0"
          >
            {copied === 'endpoint' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied === 'endpoint' ? 'Copied' : 'Copy URL'}
          </button>
        </div>
      )}

      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Version</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Download URL</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Changelog</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Released</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="px-4 py-3"><div className="h-5 bg-gray-800/60 rounded animate-pulse" /></td></tr>
                ))
              ) : versions.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">No versions published for this app yet</td></tr>
              ) : (
                versions.map(v => (
                  <tr key={v.id} className="hover:bg-gray-800/20 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-white text-sm font-bold flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-cyan-400" />
                        {v.version}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono max-w-xs truncate">
                      <a href={v.download_url} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline flex items-center gap-1">
                        <Download className="w-3 h-3" />
                        {v.download_url}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs max-w-xs truncate">
                      {v.changelog || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {v.is_latest && (
                          <span className="text-xs px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                            Latest
                          </span>
                        )}
                        {v.force_update && (
                          <span className="text-xs px-2 py-0.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 font-medium">
                            Forced
                          </span>
                        )}
                        {!v.is_latest && !v.force_update && (
                          <span className="text-xs text-gray-500">Archived</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(v.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        {!v.is_latest && (
                          <button
                            onClick={() => setLatest(v.id)}
                            className="text-xs px-2.5 py-1 rounded-lg border border-gray-700 hover:border-cyan-500 text-gray-400 hover:text-cyan-400 transition-colors"
                          >
                            Set Latest
                          </button>
                        )}
                        <button
                          onClick={() => deleteVersion(v.id)}
                          className="p-1 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {cppSnippet && (
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-sm">C++ Loader Update Check Snippet</h3>
            <button
              onClick={() => copy(cppSnippet, 'cpp-update')}
              className="text-xs text-gray-400 hover:text-white px-2.5 py-1 bg-gray-800 rounded-lg flex items-center gap-1"
            >
              {copied === 'cpp-update' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied === 'cpp-update' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="p-4 bg-black/60 rounded-xl overflow-x-auto font-mono text-xs text-gray-300 leading-relaxed">
            <code>{cppSnippet}</code>
          </pre>
        </div>
      )}

      {showCreate && (
        <Modal title="Release New Version" onClose={() => setShowCreate(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Version String *</label>
              <input
                type="text"
                value={form.version}
                onChange={e => setForm({ ...form, version: e.target.value })}
                placeholder="V1.0.1 or 2.0.0"
                className="w-full bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Download URL (DLL / Binary / ZIP) *</label>
              <input
                type="text"
                value={form.download_url}
                onChange={e => setForm({ ...form, download_url: e.target.value })}
                placeholder="https://github.com/org/repo/releases/download/v1.0.1/app.dll"
                className="w-full bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Changelog (optional)</label>
              <textarea
                value={form.changelog}
                onChange={e => setForm({ ...form, changelog: e.target.value })}
                placeholder="Bug fixes, new feature additions..."
                rows={3}
                className="w-full bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors resize-none"
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="force_update"
                checked={form.force_update}
                onChange={e => setForm({ ...form, force_update: e.target.checked })}
                className="rounded border-gray-700 text-cyan-500 focus:ring-cyan-500"
              />
              <label htmlFor="force_update" className="text-sm text-gray-300 select-none">
                Force users to update immediately before opening
              </label>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white transition-colors text-sm">Cancel</button>
              <button
                onClick={createVersion}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium text-sm hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Publish Version
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
