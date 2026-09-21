export type UserRole = 'user' | 'admin';

export interface Profile {
  id: string;
  email: string;
  username: string | null;
  role: UserRole;
  is_banned: boolean;
  ban_reason: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Application {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  version: string;
  api_secret: string;
  is_active: boolean;
  created_at: string;
  owner_username?: string | null;
  owner_email?: string | null;
}

export interface License {
  id: string;
  app_id: string;
  owner_id: string | null;
  license_key: string;
  status: 'active' | 'suspended' | 'expired' | 'banned';
  license_type: 'daily' | 'monthly' | 'lifetime';
  expires_at: string | null;
  note: string | null;
  created_at: string;
  app_name?: string;
  hwid?: string | null;
  last_reset_at?: string | null;
  reset_count?: number;
}

export interface HwidBinding {
  id: string;
  license_id: string;
  hwid: string | null;
  last_reset_at: string | null;
  reset_count: number;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  license_id: string | null;
  user_id: string | null;
  app_id: string | null;
  event_type: string;
  ip_address: string | null;
  hwid: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  app_name?: string;
  username?: string | null;
  user_email?: string | null;
}

export interface AppVersion {
  id: string;
  app_id: string;
  version: string;
  download_url: string;
  changelog: string | null;
  is_latest: boolean;
  force_update: boolean;
  created_at: string;
}

export interface DashboardStats {
  totalLicenses: number;
  activeLicenses: number;
  expiredLicenses: number;
  bannedLicenses: number;
  suspendedLicenses: number;
  totalApps: number;
  totalLogs: number;
  recentLogs: { date: string; count: number }[];
  statusBreakdown: { name: string; value: number; color: string }[];
}

export interface MonitorStats {
  apps: {
    app_id: string;
    app_name: string;
    owner: string;
    total_licenses: number;
    active_licenses: number;
    api_calls_today: number;
    api_calls_week: number;
    last_activity: string | null;
    is_active: boolean;
    unique_ips: number;
    unique_hwids: number;
  }[];
  liveActivity: {
    id: string;
    app_name: string;
    event_type: string;
    ip_address: string | null;
    hwid: string | null;
    created_at: string;
  }[];
}

export interface SystemStats {
  database: {
    totalRows: number;
    totalSize: string;
    usedBytes: number;
    totalBytes: number;
    remainingBytes: number;
    usagePercentage: number;
    tables: { name: string; rows: number; size: string }[];
  };
  performance: {
    avgQueryTime: number;
    requestsToday: number;
    uptime: string;
  };
  usage: {
    activeUsers: number;
    totalUsers: number;
    apiCallsToday: number;
    apiCallsWeek: number;
  };
  growth: {
    usersThisWeek: number;
    licensesThisWeek: number;
    appsThisWeek: number;
  };
  recentActivity: { hour: string; count: number }[];
}

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getToken(): string | null {
    return this.token || localStorage.getItem('auth_token');
  }

  async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    const token = this.getToken();

    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMessage = `HTTP Error ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        // ignore JSON parse error
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  // Auth methods
  async register(email: string, password: string, username?: string): Promise<{ token: string; user: Profile }> {
    const data = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, username }),
    });
    this.setToken(data.token);
    return data;
  }

  async login(email: string, password: string): Promise<{ token: string; user: Profile }> {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async getMe(): Promise<{ user: Profile }> {
    return this.request('/api/auth/me');
  }

  async updateProfile(updates: { username?: string; avatar_url?: string | null }): Promise<{ user: Profile }> {
    return this.request('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async uploadAvatar(file: File): Promise<{ publicUrl: string; user: Profile }> {
    const formData = new FormData();
    formData.append('avatar', file);
    return this.request('/api/auth/avatar', {
      method: 'POST',
      body: formData,
    });
  }

  logout() {
    this.setToken(null);
  }

  // Applications
  async getApplications(): Promise<Application[]> {
    return this.request('/api/applications');
  }

  async createApplication(data: { name: string; description?: string | null; version?: string }): Promise<Application> {
    return this.request('/api/applications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateApplication(id: string, data: Partial<Application>): Promise<Application> {
    return this.request(`/api/applications/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteApplication(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/applications/${id}`, {
      method: 'DELETE',
    });
  }

  async resetAppSecret(id: string): Promise<Application> {
    return this.request(`/api/applications/${id}/reset-secret`, {
      method: 'POST',
    });
  }

  // Licenses
  async getLicenses(params?: { app_id?: string; status?: string; search?: string; limit?: number }): Promise<License[]> {
    const queryStr = new URLSearchParams(params as any).toString();
    return this.request(`/api/licenses${queryStr ? `?${queryStr}` : ''}`);
  }

  async createLicense(data: { app_id: string; license_type?: string; note?: string; custom_name?: string }): Promise<License> {
    return this.request('/api/licenses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async generateBulkLicenses(data: {
    app_id: string;
    license_type?: string;
    count?: number;
    note?: string;
    custom_name?: string;
  }): Promise<{ success: boolean; licenses: License[]; count: number }> {
    return this.request('/api/licenses/bulk', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLicense(id: string, data: Partial<License>): Promise<License> {
    return this.request(`/api/licenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteLicense(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/licenses/${id}`, {
      method: 'DELETE',
    });
  }

  async bulkDeleteLicenses(data: { ids?: string[]; all?: boolean; app_id?: string }): Promise<{ success: boolean; message: string }> {
    return this.request('/api/licenses/bulk-delete', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // HWID
  async getHwidBinding(licenseId: string): Promise<HwidBinding | null> {
    return this.request(`/api/hwid/${licenseId}`);
  }

  async resetHwid(licenseId: string): Promise<{ success: boolean; message: string }> {
    return this.request('/api/hwid/reset', {
      method: 'POST',
      body: JSON.stringify({ license_id: licenseId }),
    });
  }

  // Logs
  async getLogs(params?: { page?: number; limit?: number; event_type?: string; search?: string }): Promise<ActivityLog[]> {
    const queryStr = new URLSearchParams(params as any).toString();
    return this.request(`/api/logs${queryStr ? `?${queryStr}` : ''}`);
  }

  async clearLogs(): Promise<{ success: boolean }> {
    return this.request('/api/logs/clear', {
      method: 'DELETE',
    });
  }

  // Users (Admin)
  async getUsers(): Promise<Profile[]> {
    return this.request('/api/users');
  }

  async updateUserRole(id: string, role: UserRole): Promise<Profile> {
    return this.request(`/api/users/${id}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  }

  async banUser(id: string, banned: boolean, ban_reason?: string): Promise<{ success: boolean; user: Profile }> {
    return this.request(`/api/users/${id}/ban`, {
      method: 'POST',
      body: JSON.stringify({ banned, ban_reason }),
    });
  }

  // Versions
  async getVersions(app_id?: string): Promise<AppVersion[]> {
    const queryStr = app_id ? `?app_id=${encodeURIComponent(app_id)}` : '';
    return this.request(`/api/versions${queryStr}`);
  }

  async createVersion(data: {
    app_id: string;
    version: string;
    download_url: string;
    changelog?: string;
    is_latest?: boolean;
    force_update?: boolean;
  }): Promise<AppVersion> {
    return this.request('/api/versions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateVersion(id: string, data: Partial<AppVersion>): Promise<AppVersion> {
    return this.request(`/api/versions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteVersion(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/versions/${id}`, {
      method: 'DELETE',
    });
  }

  // Stats
  async getDashboardStats(): Promise<DashboardStats> {
    return this.request('/api/stats/dashboard');
  }

  async getMonitorStats(): Promise<MonitorStats> {
    return this.request('/api/stats/monitor');
  }

  async getSystemStats(): Promise<SystemStats> {
    return this.request('/api/stats/system');
  }

  async pingDatabase(): Promise<{ status: 'connected' | 'disconnected'; ping: number }> {
    return this.request('/api/stats/ping-db');
  }

  async pingApi(): Promise<{ status: 'connected' | 'disconnected'; ping: number }> {
    return this.request('/api/stats/ping-api');
  }
}

export const api = new ApiClient();
