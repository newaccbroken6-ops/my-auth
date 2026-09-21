import { useEffect, useState } from 'react';
import { api, License, Application } from '../lib/api';
import {
  Plus, Key, Copy, Check, Search, X, Loader2,
  CheckCircle2, XCircle, Clock, Ban, RefreshCw, Cpu, Trash2, AlertTriangle
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

const STATUS_CONFIG = {
  active: { label: 'Active', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
  suspended: { label: 'Suspended', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: XCircle },
  expired: { label: 'Expired', color: 'text-gray-400 bg-gray-500/10 border-gray-500/20', icon: Clock },
  banned: { label: 'Banned', color: 'text-red-400 bg-red-500/10 border-red-500/20', icon: Ban },
};

const TYPE_CONFIG = {
  daily: { label: 'Daily', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  monthly: { label: 'Monthly', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
  lifetime: { label: 'Lifetime', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
};

function FormFields<T extends { app_id: string; license_type: string; note: string; custom_name: string }>({ 
  f, 
  setF, 
  apps 
}: { 
  f: T; 
  setF: React.Dispatch<React.SetStateAction<T>>;
  apps: Application[];
}) {
  return (
    <>
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Application *</label>
        <select
          value={f.app_id}
          onChange={e => setF(prev => ({ ...prev, app_id: e.target.value }))}
          className="w-full bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500 transition-colors"
        >
          <option value="">Select application...</option>
          {apps.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">License Type</label>
        <div className="grid grid-cols-3 gap-2">
          {(['daily', 'monthly', 'lifetime'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setF(prev => ({ ...prev, license_type: t }))}
              className={`py-2.5 rounded-xl border text-sm font-medium transition-all ${
                f.license_type === t
                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                  : 'border-gray-700 text-gray-400 hover:border-gray-600'
              }`}
            >
              {TYPE_CONFIG[t].label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Custom Name (optional)</label>
        <input
          type="text"
          value={f.custom_name}
          onChange={e => setF(prev => ({ ...prev, custom_name: e.target.value }))}
          placeholder="e.g., PREMIUM, VIP, JOHN-DOE"
          className="w-full bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
        />
        <p className="text-xs text-gray-500 mt-1">
          Format: {'{APP-NAME}'}-{'{CUSTOM-NAME}'} or leave empty for SUPER-NOVA-XXXXXXXX
        </p>
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Note (optional)</label>
        <input
          type="text"
          value={f.note}
          onChange={e => setF(prev => ({ ...prev, note: e.target.value }))}
          placeholder="Customer name, order ID..."
          className="w-full bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
        />
      </div>
    </>
  );
}

export default function LicensesPage() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [form, setForm] = useState({ app_id: '', license_type: 'monthly', note: '', custom_name: '' });
  const [bulkForm, setBulkForm] = useState({ app_id: '', license_type: 'monthly', count: 5, note: '', custom_name: '' });
  const [bulkResult, setBulkResult] = useState<License[] | null>(null);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function load() {
    try {
      const [lics, appsData] = await Promise.all([
        api.getLicenses(),
        api.getApplications(),
      ]);
      setLicenses(lics ?? []);
      setApps(appsData ?? []);
    } catch (err) {
      console.error('Failed to load licenses:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = licenses.filter(l => {
    const matchSearch = l.license_key.toLowerCase().includes(search.toLowerCase()) ||
      (l.note ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  async function copyKey(key: string) {
    await navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  async function updateStatus(id: string, status: License['status']) {
    try {
      await api.updateLicense(id, { status });
      load();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  }

  async function generateLicense() {
    if (!form.app_id) { setError('Select an application'); return; }
    setSaving(true); setError('');
    try {
      await api.createLicense({
        app_id: form.app_id,
        license_type: form.license_type,
        note: form.note.trim() || undefined,
        custom_name: form.custom_name.trim() || undefined,
      });
      setShowCreate(false);
      setForm({ app_id: '', license_type: 'monthly', note: '', custom_name: '' });
      load();
    } catch (err: any) {
      setError(err.message || 'Failed to create license');
    } finally {
      setSaving(false);
    }
  }

  async function generateBulk() {
    if (!bulkForm.app_id) { setError('Select an application'); return; }
    setSaving(true); setError('');
    try {
      const data = await api.generateBulkLicenses({
        app_id: bulkForm.app_id,
        license_type: bulkForm.license_type,
        count: bulkForm.count,
        note: bulkForm.note.trim() || undefined,
        custom_name: bulkForm.custom_name.trim() || undefined,
      });
      setBulkResult(data.licenses);
      load();
    } catch (err: any) {
      setError(err.message || 'Failed to generate bulk licenses');
    } finally {
      setSaving(false);
    }
  }

  async function resetHwid(licenseId: string) {
    try {
      const res = await api.resetHwid(licenseId);
      alert(res.message);
      load();
    } catch (err: any) {
      alert(err.message || 'Failed to reset HWID');
    }
  }

  async function deleteLicense(id: string) {
    if (!confirm('Are you sure you want to delete this license?')) return;
    try {
      await api.deleteLicense(id);
      load();
    } catch (err) {
      console.error('Failed to delete license:', err);
    }
  }

  async function deleteAllLicenses() {
    if (deleteConfirmText !== 'DELETE ALL') {
      setError('Please type DELETE ALL to confirm');
      return;
    }
    setDeleting(true);
    setError('');
    try {
      await api.bulkDeleteLicenses({ all: true });
      setShowDeleteAll(false);
      setDeleteConfirmText('');
      load();
    } catch (err: any) {
      setError(err.message || 'Failed to delete licenses');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Licenses</h1>
          <p className="text-gray-400 mt-1">Manage and generate application licenses</p>
        </div>
        <div className="flex items-center gap-2">
          {licenses.length > 0 && (
            <button
              onClick={() => setShowDeleteAll(true)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm font-medium transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Delete All
            </button>
          )}
          <button
            onClick={() => { setShowBulk(true); setBulkResult(null); }}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-700 text-gray-300 hover:text-white hover:border-gray-600 text-sm font-medium transition-all"
          >
            <Key className="w-4 h-4" />
            Bulk Generate
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium text-sm hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/20"
          >
            <Plus className="w-4 h-4" />
            New License
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by key or note..."
            className="w-full bg-gray-900/60 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors text-sm"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'active', 'suspended', 'expired', 'banned'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-medium capitalize transition-all ${
                statusFilter === s
                  ? 'bg-cyan-500/20 border border-cyan-500 text-cyan-400'
                  : 'bg-gray-900/60 border border-gray-800 text-gray-400 hover:border-gray-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">License Key</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">App</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expires</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">HWID</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-5 bg-gray-800/60 rounded animate-pulse" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">No licenses found</td></tr>
              ) : (
                filtered.map(lic => {
                  const statusCfg = STATUS_CONFIG[lic.status] || STATUS_CONFIG.active;
                  const typeCfg = TYPE_CONFIG[lic.license_type] || TYPE_CONFIG.monthly;
                  const StatusIcon = statusCfg.icon;

                  return (
                    <tr key={lic.id} className="hover:bg-gray-800/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-white text-sm font-medium">{lic.license_key}</span>
                          <button
                            onClick={() => copyKey(lic.license_key)}
                            className="text-gray-500 hover:text-cyan-400 transition-colors"
                          >
                            {copiedKey === lic.license_key ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        {lic.note && <p className="text-gray-500 text-xs mt-0.5">{lic.note}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-sm">{lic.app_name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-lg border font-medium ${typeCfg.color}`}>
                          {typeCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-lg border font-medium ${statusCfg.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {lic.license_type === 'lifetime' ? 'Lifetime' : lic.expires_at ? new Date(lic.expires_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Cpu className="w-3.5 h-3.5 text-gray-500" />
                          <span className="text-gray-400 text-xs font-mono">
                            {lic.hwid ? `${lic.hwid.slice(0, 10)}...` : 'Unbound'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => resetHwid(lic.id)}
                            className="p-1 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-cyan-400 transition-colors"
                            title="Reset HWID"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <select
                            value={lic.status}
                            onChange={e => updateStatus(lic.id, e.target.value as any)}
                            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-cyan-500"
                          >
                            <option value="active">Active</option>
                            <option value="suspended">Suspended</option>
                            <option value="banned">Banned</option>
                            <option value="expired">Expired</option>
                          </select>
                          <button
                            onClick={() => deleteLicense(lic.id)}
                            className="p-1 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <Modal title="Create License" onClose={() => setShowCreate(false)}>
          <div className="space-y-4">
            <FormFields f={form} setF={setForm} apps={apps} />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white transition-colors text-sm">Cancel</button>
              <button
                onClick={generateLicense}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium text-sm hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Generate
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showBulk && (
        <Modal title="Bulk Generate Licenses" onClose={() => { setShowBulk(false); setBulkResult(null); }}>
          <div className="space-y-4">
            {!bulkResult ? (
              <>
                <FormFields f={bulkForm} setF={setBulkForm} apps={apps} />
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Count (1 - 100)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={bulkForm.count}
                    onChange={e => setBulkForm(prev => ({ ...prev, count: parseInt(e.target.value) || 1 }))}
                    className="w-full bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowBulk(false)} className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white transition-colors text-sm">Cancel</button>
                  <button
                    onClick={generateBulk}
                    disabled={saving}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium text-sm hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Generate {bulkForm.count} Keys
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-emerald-400 text-sm font-medium">Successfully generated {bulkResult.length} licenses:</p>
                <div className="max-h-60 overflow-y-auto space-y-1.5 p-3 bg-gray-800/60 rounded-xl font-mono text-xs text-gray-300">
                  {bulkResult.map(l => (
                    <div key={l.id} className="flex justify-between items-center py-1 border-b border-gray-700/50 last:border-0">
                      <span>{l.license_key}</span>
                      <button onClick={() => copyKey(l.license_key)} className="text-gray-400 hover:text-cyan-400">
                        {copiedKey === l.license_key ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => { setShowBulk(false); setBulkResult(null); }}
                  className="w-full py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium transition-colors"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {showDeleteAll && (
        <Modal title="Delete All Licenses" onClose={() => setShowDeleteAll(false)}>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <p>Warning: This action will permanently delete all licenses. It cannot be undone.</p>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Type <strong className="text-white font-mono">DELETE ALL</strong> to confirm</label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE ALL"
                className="w-full bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 transition-colors"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowDeleteAll(false)} className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white transition-colors text-sm">Cancel</button>
              <button
                onClick={deleteAllLicenses}
                disabled={deleting || deleteConfirmText !== 'DELETE ALL'}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Confirm Delete All
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
