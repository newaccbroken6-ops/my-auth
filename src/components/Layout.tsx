import { useState, ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, Key, AppWindow, Activity, Users,
  Settings, LogOut, ChevronLeft, ChevronRight, Zap,
  Shield, Menu, Upload, Code, Database, Monitor
} from 'lucide-react';
import AnimatedBackground from './AnimatedBackground';

type Page = 'dashboard' | 'applications' | 'licenses' | 'logs' | 'users' | 'settings' | 'updates' | 'system' | 'monitor' | 'terminal';

interface NavItem {
  id: Page;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'applications', label: 'Applications', icon: AppWindow },
  { id: 'updates', label: 'Updates', icon: Upload },
  { id: 'licenses', label: 'Licenses', icon: Key },
  { id: 'logs', label: 'Activity Logs', icon: Activity },
  { id: 'users', label: 'Users', icon: Users, adminOnly: true },
  { id: 'monitor', label: 'Apps Monitor', icon: Monitor, adminOnly: true },
  { id: 'system', label: 'System Analytics', icon: Database, adminOnly: true },
  { id: 'terminal', label: 'Terminal', icon: Shield, adminOnly: true },
  { id: 'settings', label: 'Settings', icon: Settings },
];

interface LayoutProps {
  page: Page;
  setPage: (p: Page) => void;
  children: ReactNode;
}

export default function Layout({ page, setPage, children }: LayoutProps) {
  const { profile, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleItems = navItems.filter(item => !item.adminOnly || profile?.role === 'admin');

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-gray-800 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400/10 via-blue-500/10 to-purple-600/10 backdrop-blur-sm flex items-center justify-center flex-shrink-0 shadow-lg shadow-cyan-500/20 border border-cyan-500/20">
          <img 
            src="/logo.png" 
            alt="SUPER NOVA Logo" 
            className="w-7 h-7 object-contain drop-shadow-lg"
          />
        </div>
        {!collapsed && (
          <div>
            <div className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-white font-bold text-sm tracking-tight">SUPER NOVA</span>
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <span className="text-cyan-400/70 text-xs font-mono tracking-widest">KEYS</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleItems.map(item => {
          const Icon = item.icon;
          const active = page === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { setPage(item.id); setMobileOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                active
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 text-cyan-400'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
              } ${collapsed ? 'justify-center' : ''}`}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-cyan-400' : ''}`} />
              {!collapsed && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
              {active && !collapsed && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400" />
              )}
            </button>
          );
        })}
      </nav>

      {/* User info */}
      <div className={`px-3 py-4 border-t border-gray-800 space-y-2`}>
        {!collapsed && (
          <>
            <div className="px-3 py-2 rounded-xl bg-gray-800/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/30 to-blue-600/30 border border-cyan-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {profile?.avatar_url ? (
                    <img 
                      src={profile.avatar_url} 
                      alt="Avatar" 
                      className="w-full h-full object-cover"
                    />
                  ) : profile?.role === 'admin' ? (
                    <Shield className="w-4 h-4 text-cyan-400" />
                  ) : (
                    <span className="text-cyan-400 font-bold text-sm">
                      {(profile?.username ?? profile?.email ?? 'U')[0].toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {profile?.username ?? 'User'}
                  </p>
                  <p className="text-gray-500 text-xs truncate">{profile?.email}</p>
                </div>
              </div>
              {profile?.role === 'admin' && (
                <div className="mt-2 flex items-center gap-1.5">
                  <Shield className="w-3 h-3 text-cyan-400" />
                  <span className="text-cyan-400 text-xs font-mono">ADMIN</span>
                </div>
              )}
            </div>
            {/* Developer credit */}
            <div className="px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-500/5 to-purple-500/5 border border-cyan-500/10">
              <div className="flex items-center justify-center gap-2">
                <Code className="w-3.5 h-3.5 text-cyan-400" />
                <p className="text-gray-600 text-xs font-mono">
                  DEV: <span className="text-cyan-400 font-semibold">LinuxKING</span>
                </p>
              </div>
            </div>
          </>
        )}
        <button
          onClick={signOut}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 ${collapsed ? 'justify-center' : ''}`}
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span className="text-sm font-medium">Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Animated gradient background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <AnimatedBackground />
      </div>

      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex flex-col bg-gray-900/80 backdrop-blur border-r border-gray-800 transition-all duration-300 relative z-10 ${collapsed ? 'w-16' : 'w-64'}`}>
        <SidebarContent />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute left-full top-1/2 -translate-y-1/2 ml-1 w-5 h-8 bg-gray-800 border border-gray-700 rounded-r-lg flex items-center justify-center text-gray-400 hover:text-white transition-colors z-10"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-gray-900 border-r border-gray-800 z-50">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative z-10">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-gray-900/80 border-b border-gray-800 backdrop-blur flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <img 
                src="/logo.png" 
                alt="SUPER NOVA Logo" 
                className="w-6 h-6 object-contain drop-shadow-lg"
              />
              <Zap className="w-4 h-4 text-cyan-400" />
              <span className="text-white font-bold text-sm">SUPER NOVA KEYS</span>
            </div>
          </div>
          <div className="text-gray-600 text-xs font-mono flex items-center gap-1.5">
            {profile?.avatar_url ? (
              <img 
                src={profile.avatar_url} 
                alt="Avatar" 
                className="w-6 h-6 rounded-full object-cover border border-cyan-500/30"
              />
            ) : (
              <>
                <Code className="w-3 h-3 text-cyan-400" />
                <span className="text-cyan-400 font-semibold">LinuxKING</span>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto scrollbar-thin relative z-10">
          {children}
        </main>
      </div>
    </div>
  );
}
