import { useEffect, useState } from 'react';
import { api, Profile } from '../lib/api';
import { Users, Shield, ShieldOff, Search, Ban, CheckCircle2, X } from 'lucide-react';

function BanModal({ user, onClose, onConfirm }: { user: Profile; onClose: () => void; onConfirm: (reason: string, banned: boolean) => void }) {
  const [reason, setReason] = useState(user.ban_reason ?? '');
  const banning = !user.is_banned;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h3 className="text-white font-semibold">{banning ? 'Ban User' : 'Unban User'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-gray-400 text-sm">
            {banning ? `Are you sure you want to ban ${user.email}?` : `Unban ${user.email}?`}
          </p>
          {banning && (
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Reason (optional)</label>
              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Reason for ban..."
                className="w-full bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white transition-colors text-sm">Cancel</button>
            <button
              onClick={() => onConfirm(reason, banning)}
              className={`flex-1 py-2.5 rounded-xl text-white font-medium text-sm transition-all ${
                banning ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              {banning ? 'Ban User' : 'Unban User'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [banTarget, setBanTarget] = useState<Profile | null>(null);

  async function load() {
    try {
      const data = await api.getUsers();
      setUsers(data ?? []);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.username ?? '').toLowerCase().includes(search.toLowerCase())
  );

  async function handleBan(reason: string, banned: boolean) {
    if (!banTarget) return;
    try {
      await api.banUser(banTarget.id, banned, reason || undefined);
      setBanTarget(null);
      load();
    } catch (err) {
      console.error('Failed to ban user:', err);
    }
  }

  async function toggleAdmin(userId: string, currentRole: string) {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await api.updateUserRole(userId, newRole);
      load();
    } catch (err) {
      console.error('Failed to update user role:', err);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">User Management</h1>
        <p className="text-gray-400 mt-1">Manage registered users, roles, and bans</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by email or username..."
          className="w-full bg-gray-900/60 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors text-sm"
        />
      </div>

      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={5} className="px-4 py-3"><div className="h-5 bg-gray-800/60 rounded animate-pulse" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center">
                  <Users className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                  <p className="text-gray-500">No users found</p>
                </td></tr>
              ) : filtered.map(u => (
                <tr key={u.id} className="hover:bg-gray-800/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
                        {u.avatar_url ? (
                          <img 
                            src={u.avatar_url} 
                            alt={u.username ?? u.email} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/20 flex items-center justify-center">
                            <span className="text-cyan-400 font-bold text-xs">
                              {(u.username ?? u.email)[0].toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{u.username ?? '—'}</p>
                        <p className="text-gray-500 text-xs">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border font-medium ${
                      u.role === 'admin'
                        ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'
                        : 'text-gray-400 bg-gray-500/10 border-gray-700'
                    }`}>
                      {u.role === 'admin' && <Shield className="w-3 h-3" />}
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.is_banned ? (
                      <div>
                        <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border font-medium text-red-400 bg-red-500/10 border-red-500/20">
                          <Ban className="w-3 h-3" /> Banned
                        </span>
                        {u.ban_reason && <p className="text-gray-500 text-xs mt-1">{u.ban_reason}</p>}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border font-medium text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" /> Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => toggleAdmin(u.id, u.role)}
                        className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                          u.role === 'admin'
                            ? 'bg-gray-800 border-gray-700 text-gray-400 hover:text-amber-400 hover:border-amber-500/30'
                            : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20'
                        }`}
                        title={u.role === 'admin' ? 'Revoke admin' : 'Make admin'}
                      >
                        {u.role === 'admin' ? <ShieldOff className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => setBanTarget(u)}
                        className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                          u.is_banned
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                            : 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
                        }`}
                      >
                        {u.is_banned ? 'Unban' : 'Ban'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {banTarget && (
        <BanModal user={banTarget} onClose={() => setBanTarget(null)} onConfirm={handleBan} />
      )}
    </div>
  );
}
