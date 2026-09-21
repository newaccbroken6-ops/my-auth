import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, themes, Theme } from '../contexts/ThemeContext';
import { api } from '../lib/api';
import { User, Copy, Check, Loader2, Code, BookOpen, Camera, Palette } from 'lucide-react';

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const [username, setUsername] = useState(profile?.username ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [tab, setTab] = useState<'profile' | 'sdk'>('profile');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  async function saveProfile() {
    if (!username.trim()) return;
    setSaving(true); setError('');
    try {
      await api.updateProfile({ username: username.trim() });
      setSaved(true);
      await refreshProfile();
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  async function copy(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  async function uploadAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    try {
      setUploading(true);
      setUploadError('');

      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      const file = event.target.files[0];
      const fileSize = file.size / 1024 / 1024; // MB

      if (fileSize > 5) {
        setUploadError('File size must be less than 5MB');
        setUploading(false);
        return;
      }

      if (!file.type.startsWith('image/')) {
        setUploadError('File must be an image');
        setUploading(false);
        return;
      }

      await api.uploadAvatar(file);
      await refreshProfile();
    } catch (error: any) {
      setUploadError(error.message || 'Error uploading avatar');
    } finally {
      setUploading(false);
    }
  }

  async function removeAvatar() {
    try {
      setUploading(true);
      setUploadError('');
      await api.updateProfile({ avatar_url: null });
      await refreshProfile();
    } catch (error: any) {
      setUploadError(error.message || 'Error removing avatar');
    } finally {
      setUploading(false);
    }
  }

  const apiHost = window.location.origin;

  const cppCode = `// SUPER NOVA KEYS — C++ Integration
// Include: cpr/cpr.h (or wininet/libcurl) and nlohmann/json.hpp

#include <iostream>
#include <string>
#include <cpr/cpr.h>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

const std::string SUPERNOVA_URL = "${apiHost}/api/v1/validate-license";
const std::string APP_ID = "YOUR_APP_ID";

struct ValidationResult {
    bool valid;
    std::string message;
    std::string license_type;
    std::string expires_at;
};

ValidationResult validateLicense(const std::string& licenseKey, const std::string& hwid) {
    json payload = {
        {"license_key", licenseKey},
        {"hwid", hwid},
        {"app_id", APP_ID}
    };

    cpr::Response r = cpr::Post(
        cpr::Url{SUPERNOVA_URL},
        cpr::Header{
            {"Content-Type", "application/json"}
        },
        cpr::Body{payload.dump()}
    );

    ValidationResult result;
    if (r.status_code == 200) {
        auto res = json::parse(r.text);
        result.valid = res["valid"].get<bool>();
        result.message = res["message"].get<std::string>();
        if (result.valid) {
            result.license_type = res.value("license_type", "");
            result.expires_at = res.value("expires_at", "");
        }
    } else {
        result.valid = false;
        result.message = "Server error: " + std::to_string(r.status_code);
    }
    return result;
}`;

  const pythonCode = `# SUPER NOVA KEYS — Python Integration
import requests

SUPERNOVA_URL = "${apiHost}/api/v1/validate-license"
APP_ID = "YOUR_APP_ID"

def validate_license(license_key: str, hwid: str) -> dict:
    headers = {
        "Content-Type": "application/json",
    }
    payload = {
        "license_key": license_key,
        "hwid": hwid,
        "app_id": APP_ID,
    }
    try:
        r = requests.post(SUPERNOVA_URL, json=payload, headers=headers, timeout=10)
        return r.json()
    except Exception as e:
        return {"valid": False, "message": str(e)}

# Example usage
result = validate_license("XXXX-XXXX-XXXX-XXXX", "unique_hwid_123")
print(result)`;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings & Integration</h1>
        <p className="text-gray-400 mt-1">Manage account preferences and client SDK code</p>
      </div>

      <div className="flex gap-2 border-b border-gray-800 pb-3">
        <button
          onClick={() => setTab('profile')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === 'profile'
              ? 'bg-cyan-500/20 border border-cyan-500 text-cyan-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <User className="w-4 h-4" />
          Profile & Theme
        </button>
        <button
          onClick={() => setTab('sdk')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === 'sdk'
              ? 'bg-cyan-500/20 border border-cyan-500 text-cyan-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Code className="w-4 h-4" />
          API & SDK Integration
        </button>
      </div>

      {tab === 'profile' && (
        <div className="space-y-5">
          {/* Avatar Section */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Profile Photo</h2>
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-800 border border-gray-700 flex items-center justify-center">
                  {profile?.avatar_url ? (
                    <img 
                      src={profile.avatar_url} 
                      alt="Avatar" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-8 h-8 text-gray-500" />
                  )}
                </div>
                {uploading && (
                  <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm font-medium transition-colors">
                  <Camera className="w-4 h-4" />
                  Upload Photo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={uploadAvatar}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
                {profile?.avatar_url && (
                  <button
                    onClick={removeAvatar}
                    disabled={uploading}
                    className="block text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Remove photo
                  </button>
                )}
                {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}
                <p className="text-xs text-gray-500">JPG, PNG, GIF up to 5MB</p>
              </div>
            </div>
          </div>

          {/* User Details */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white mb-2">Account Info</h2>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <input
                type="text"
                value={profile?.email ?? user?.email ?? ''}
                disabled
                className="w-full bg-gray-800/40 border border-gray-800 rounded-xl px-4 py-2.5 text-gray-400 font-mono text-sm cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Your username"
                className="w-full bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500 transition-colors text-sm"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={saveProfile}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium text-sm hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 transition-all shadow-lg shadow-cyan-500/20"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4 text-emerald-300" /> : null}
              {saved ? 'Saved!' : 'Save Changes'}
            </button>
          </div>

          {/* Theme Selection */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-semibold text-white">Theme Customization</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {(Object.entries(themes) as [Theme, typeof themes[Theme]][]).map(([id, t]) => (
                <button
                  key={id}
                  onClick={() => setTheme(id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    theme === id
                      ? 'bg-cyan-500/10 border-cyan-500 text-white shadow-lg shadow-cyan-500/10'
                      : 'bg-gray-800/40 border-gray-700/50 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-3.5 h-3.5 rounded-full" style={{ background: t.primary }} />
                    <span className="text-xs font-semibold">{t.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'sdk' && (
        <div className="space-y-6">
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-cyan-400" />
                <h3 className="text-white font-semibold">C++ Client Implementation</h3>
              </div>
              <button
                onClick={() => copy(cppCode, 'cpp')}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700"
              >
                {copied === 'cpp' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied === 'cpp' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="p-4 bg-black/60 rounded-xl overflow-x-auto font-mono text-xs text-gray-300 leading-relaxed">
              <code>{cppCode}</code>
            </pre>
          </div>

          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-400" />
                <h3 className="text-white font-semibold">Python Client Implementation</h3>
              </div>
              <button
                onClick={() => copy(pythonCode, 'py')}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700"
              >
                {copied === 'py' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied === 'py' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="p-4 bg-black/60 rounded-xl overflow-x-auto font-mono text-xs text-gray-300 leading-relaxed">
              <code>{pythonCode}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
