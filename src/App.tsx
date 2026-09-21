import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AuthPage from './pages/AuthPage';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import ApplicationsPage from './pages/ApplicationsPage';
import LicensesPage from './pages/LicensesPage';
import LogsPage from './pages/LogsPage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';
import UpdatesPage from './pages/UpdatesPage';
import SystemPage from './pages/SystemPage';
import MonitorPage from './pages/MonitorPage';
import TerminalPage from './pages/TerminalPage';
import { Loader2, Zap } from 'lucide-react';

type Page = 'dashboard' | 'applications' | 'licenses' | 'logs' | 'users' | 'settings' | 'updates' | 'system' | 'monitor' | 'terminal';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [page, setPage] = useState<Page>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2">
            <Zap className="w-5 h-5 text-cyan-400" />
            <span className="text-white font-bold tracking-tight">SUPER NOVA KEYS</span>
            <Zap className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="flex justify-center">
            <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) return <AuthPage />;

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <DashboardPage />;
      case 'applications': return <ApplicationsPage />;
      case 'licenses': return <LicensesPage />;
      case 'logs': return <LogsPage />;
      case 'updates': return <UpdatesPage />;
      case 'users': return profile?.role === 'admin' ? <UsersPage /> : <DashboardPage />;
      case 'monitor': return profile?.role === 'admin' ? <MonitorPage /> : <DashboardPage />;
      case 'system': return profile?.role === 'admin' ? <SystemPage /> : <DashboardPage />;
      case 'terminal': return profile?.role === 'admin' ? <TerminalPage /> : <DashboardPage />;
      case 'settings': return <SettingsPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <Layout page={page} setPage={setPage}>
      {renderPage()}
    </Layout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
