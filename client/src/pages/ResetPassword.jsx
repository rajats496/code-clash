import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SwordsIcon } from '../components/common/Icons';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { resetPassword } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    const result = await resetPassword(token, newPassword, confirmPassword);
    setLoading(false);
    if (result.success) {
      setSuccess(true);
    } else {
      setError(result.error);
    }
  };

  const inputClasses = 'w-full bg-slate-900/60 border border-slate-600/50 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30 transition-all';

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        </div>
        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <Link to="/" className="inline-block">
              <div className="flex items-center justify-center gap-2">
                <SwordsIcon size={36} className="text-[#ffa116]" />
                <span className="bg-gradient-to-r from-orange-400 via-orange-500 to-red-500 bg-clip-text text-transparent">CodeClash</span>
              </div>
            </Link>
          </div>
          <div className="rounded-2xl p-8 bg-slate-800/40 border border-slate-700/50 backdrop-blur shadow-2xl shadow-black/20">
            <p className="text-slate-400 mb-4">Invalid or expired reset link. Please request a new password reset.</p>
            <Link to="/login" className="font-bold text-orange-400 hover:text-orange-300 transition-colors">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <div className="flex items-center justify-center gap-2">
              <SwordsIcon size={36} className="text-[#ffa116]" />
              <span className="bg-gradient-to-r from-orange-400 via-orange-500 to-red-500 bg-clip-text text-transparent">CodeClash</span>
            </div>
          </Link>
          <p className="text-sm text-slate-400 mt-2 font-mono">Set a new password</p>
        </div>

        <div className="rounded-2xl p-8 bg-slate-800/40 border border-slate-700/50 backdrop-blur shadow-2xl shadow-black/20">
          <h2 className="text-xl font-bold text-slate-50 mb-1">Reset password</h2>
          <p className="text-sm text-slate-400 mb-6">Enter your new password below</p>

          {error && (
            <div className="p-3 rounded-xl text-sm font-medium flex items-center gap-2 mb-5 bg-red-500/10 border border-red-500/30 text-red-400">
              <span>⚠️</span> {error}
            </div>
          )}
          {success && (
            <div className="p-3 rounded-xl text-sm font-medium flex items-center gap-2 mb-5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              Password has been reset. You can now sign in with your new password.
            </div>
          )}

          {success ? (
            <Link to="/login" className="block w-full py-3 rounded-xl text-sm font-bold text-center transition-all"
              style={{ background: 'linear-gradient(135deg,#ffa116,#ff7a00)', color: '#1a1a1a' }}>
              Sign in
            </Link>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">New password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={inputClasses + ' pr-12'}
                    placeholder="Min 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors">
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Confirm password</label>
                <input
                  type="password"
                  className={inputClasses}
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-red-400 mt-1 font-medium">Passwords don&apos;t match</p>
                )}
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-bold active:scale-95 transition-all shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#ffa116,#ff7a00)', color: '#1a1a1a' }}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-slate-900 border-t-transparent animate-spin" /> Resetting...
                  </span>
                ) : (
                  'Reset password'
                )}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-slate-400">
            <Link to="/login" className="font-bold text-orange-400 hover:text-orange-300 transition-colors">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
