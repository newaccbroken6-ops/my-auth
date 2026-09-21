import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, Loader2, Zap, Sparkles, LogIn, UserPlus, Rocket, CheckCircle, XCircle, Code } from 'lucide-react';
import Particles from '../components/Particles';

type Mode = 'signin' | 'signup';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (mode === 'signin') {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    } else {
      if (!username.trim()) {
        setError('Username is required');
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, username);
      if (error) setError(error);
      else setSuccess('Account created! You can now sign in.');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated particles background */}
      <Particles />
      
      {/* Enhanced background glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative w-full max-w-md z-10">
        {/* Logo with glow effect */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-400/10 via-blue-500/10 to-purple-600/10 backdrop-blur-sm shadow-2xl shadow-cyan-500/50 mb-6 relative group border border-cyan-500/20">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 blur-xl opacity-50 group-hover:opacity-70 transition-opacity" />
            <img 
              src="/logo.png" 
              alt="SUPER NOVA Logo" 
              className="w-20 h-20 object-contain relative z-10 drop-shadow-2xl"
            />
          </div>
          <div className="flex items-center justify-center gap-3 mb-2">
            <Sparkles className="w-6 h-6 text-cyan-400 animate-pulse" />
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 tracking-tight">
              SUPER NOVA
            </h1>
            <Sparkles className="w-6 h-6 text-purple-400 animate-pulse" style={{ animationDelay: '0.5s' }} />
          </div>
          <p className="text-cyan-400/90 text-base font-mono tracking-widest font-bold">KEYS</p>
          <p className="text-gray-400 text-sm mt-3">Next-Gen License Management Platform</p>
        </div>

        {/* Card with glass morphism effect */}
        <div className="bg-gray-900/40 backdrop-blur-2xl border border-gray-700/50 rounded-3xl p-8 shadow-2xl shadow-black/50 relative overflow-hidden">
          {/* Gradient overlay on card */}
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5 pointer-events-none" />
          
          <div className="relative z-10">{/* Tabs */}
          <div className="flex rounded-2xl bg-gray-800/60 backdrop-blur-sm p-1.5 mb-8 border border-gray-700/30">
            {(['signin', 'signup'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); setSuccess(''); }}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                  mode === m
                    ? 'bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 text-white shadow-lg shadow-cyan-500/30'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/30'
                }`}
              >
                {m === 'signin' ? (
                  <>
                    <LogIn className="w-4 h-4" />
                    Sign In
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Sign Up
                  </>
                )}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="your_username"
                  className="w-full bg-gray-800/60 backdrop-blur-sm border border-gray-700/50 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 transition-all duration-200"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-gray-800/60 backdrop-blur-sm border border-gray-700/50 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-gray-800/60 backdrop-blur-sm border border-gray-700/50 rounded-xl px-4 py-3.5 pr-12 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-cyan-400 transition-colors"
                >
                  {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 backdrop-blur-sm border border-red-500/30 rounded-xl px-4 py-3.5 text-red-400 text-sm font-medium flex items-center gap-2">
                <XCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
            {success && (
              <div className="bg-emerald-500/10 backdrop-blur-sm border border-emerald-500/30 rounded-xl px-4 py-3.5 text-emerald-400 text-sm font-medium flex items-center gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 text-white font-bold text-base hover:from-cyan-400 hover:via-blue-400 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-xl shadow-cyan-500/30 hover:shadow-cyan-500/50 flex items-center justify-center gap-2 group"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
              ) : (
                <>
                  {mode === 'signin' ? (
                    <>
                      <Rocket className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      Sign In Now
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                      Create Account
                    </>
                  )}
                  <Zap className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                </>
              )}
            </button>
          </form>
          </div>
        </div>

        <p className="text-center text-gray-600 text-xs mt-8 font-mono flex items-center justify-center gap-2">
          <Zap className="w-3 h-3 text-cyan-500" />
          SUPER-NOVA-KEYS v1.0 — Next-Gen License Management
          <Zap className="w-3 h-3 text-purple-500" />
        </p>
        <div className="flex items-center justify-center gap-2 mt-3">
          <Code className="w-3.5 h-3.5 text-cyan-500" />
          <p className="text-gray-500 text-xs font-mono">
            DEV: <span className="text-cyan-400 font-bold">LinuxKING</span>
          </p>
        </div>
      </div>
    </div>
  );
}
