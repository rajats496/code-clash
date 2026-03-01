import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GoogleLoginButton from '../components/auth/GoogleLoginButton';
import { SwordsIcon } from '../components/common/Icons';

const Login = () => {
  const { isAuthenticated, loginWithEmail, requestGmailOtp, loginWithGmailOtp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Gmail OTP flow (only for user role)
  const [gmailOtpEmail, setGmailOtpEmail] = useState('');
  const [otpSentTo, setOtpSentTo] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpRequestLoading, setOtpRequestLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate('/matchmaking');
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please fill in all fields'); return; }

    setLoading(true);
    const result = await loginWithEmail({ email, password, role });
    setLoading(false);

    if (result.success) {
      navigate('/matchmaking');
    } else {
      setError(result.error);
    }
  };

  const handleRequestGmailOtp = async (e) => {
    e.preventDefault();
    setError('');
    const gmail = gmailOtpEmail.trim().toLowerCase();
    if (!gmail || !gmail.endsWith('@gmail.com')) {
      setError('Please enter a valid Gmail address (@gmail.com)');
      return;
    }
    setOtpRequestLoading(true);
    const result = await requestGmailOtp(gmail);
    setOtpRequestLoading(false);
    if (result.success) {
      setOtpSentTo(gmail);
      setOtpValue('');
      setError('');
    } else {
      setError(result.error);
    }
  };

  const handleVerifyGmailOtp = async (e) => {
    e.preventDefault();
    setError('');
    const gmail = otpSentTo.trim();
    if (!gmail || !otpValue.trim()) {
      setError('Enter the 6-digit code from your email');
      return;
    }
    setOtpLoading(true);
    const result = await loginWithGmailOtp(gmail, otpValue.trim());
    setOtpLoading(false);
    if (result.success) {
      navigate('/matchmaking');
    } else {
      setError(result.error);
    }
  };

  const inputClasses = "w-full bg-slate-900/60 border border-slate-600/50 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30 transition-all";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <div className="flex items-center justify-center gap-2">
              <SwordsIcon size={36} className="text-[#ffa116]" />
              <span className="bg-gradient-to-r from-orange-400 via-orange-500 to-red-500 bg-clip-text text-transparent">CodeClash</span>
            </div>
          </Link>
          <p className="text-sm text-slate-400 mt-2 font-mono">
            Real-time 1v1 coding battles
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8 bg-slate-800/40 border border-slate-700/50 backdrop-blur shadow-2xl shadow-black/20">
          <h2 className="text-xl font-bold text-slate-50 mb-1">Welcome back</h2>
          <p className="text-sm text-slate-400 mb-6">Sign in to your account</p>

          {error && (
            <div className="p-3 rounded-xl text-sm font-medium flex items-center gap-2 mb-5 bg-red-500/10 border border-red-500/30 text-red-400">
              <span>⚠️</span> {error}
            </div>
          )}

          {/* Email form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Role Toggle */}
            <div className="flex bg-slate-900/60 p-1 rounded-xl border border-slate-600/50 mb-6">
              <button
                type="button"
                onClick={() => setRole('user')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${role === 'user' ? 'bg-orange-500 text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              >
                User
              </button>
              <button
                type="button"
                onClick={() => setRole('admin')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${role === 'admin' ? 'bg-orange-500 text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Admin
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input type="email" className={inputClasses} placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} className={inputClasses + ' pr-12'}
                  placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors">
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-bold active:scale-95 transition-all shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 disabled:opacity-50 disabled:active:scale-100 relative overflow-hidden group"
              style={{ background: 'linear-gradient(135deg,#ffa116,#ff7a00)', color: '#1a1a1a' }}>
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? (
                  <><div className="w-4 h-4 rounded-full border-2 border-slate-900 border-t-transparent animate-spin" /> Signing in...</>
                ) : (
                  <><span className="text-base group-hover:scale-110 transition-transform">🚀</span> Sign In</>
                )}
              </span>
              <span className="absolute inset-0 bg-gradient-to-r from-orange-600 to-red-700 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </form>

          {/* Google + Gmail OTP (Only for Users) */}
          {role === 'user' && (
            <>
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-slate-700/50" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-slate-700/50" />
              </div>

              <GoogleLoginButton />

              {/* Gmail OTP */}
              <div className="mt-6 pt-6 border-t border-slate-700/50">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-3">Login with Gmail OTP</p>
                {!otpSentTo ? (
                  <form onSubmit={handleRequestGmailOtp} className="flex gap-2">
                    <input
                      type="email"
                      className={inputClasses + ' flex-1'}
                      placeholder="you@gmail.com"
                      value={gmailOtpEmail}
                      onChange={(e) => setGmailOtpEmail(e.target.value)}
                      autoComplete="email"
                    />
                    <button
                      type="submit"
                      disabled={otpRequestLoading}
                      className="px-4 py-3 rounded-xl text-sm font-bold bg-slate-700/60 hover:bg-slate-600/60 text-slate-200 border border-slate-600/50 disabled:opacity-50 transition-all"
                    >
                      {otpRequestLoading ? (
                        <div className="w-4 h-4 rounded-full border-2 border-slate-400 border-t-transparent animate-spin mx-auto" />
                      ) : (
                        'Send OTP'
                      )}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyGmailOtp} className="space-y-3">
                    <p className="text-xs text-slate-400">Code sent to <strong className="text-slate-300">{otpSentTo}</strong></p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        className={inputClasses + ' flex-1 text-center tracking-[0.3em]'}
                        placeholder="000000"
                        value={otpValue}
                        onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        autoComplete="one-time-code"
                      />
                      <button
                        type="submit"
                        disabled={otpLoading || otpValue.length !== 6}
                        className="px-4 py-3 rounded-xl text-sm font-bold disabled:opacity-50 transition-all"
                        style={{ background: 'linear-gradient(135deg,#ffa116,#ff7a00)', color: '#1a1a1a' }}
                      >
                        {otpLoading ? (
                          <div className="w-4 h-4 rounded-full border-2 border-slate-900 border-t-transparent animate-spin" />
                        ) : (
                          'Verify'
                        )}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setOtpSentTo(''); setOtpValue(''); setError(''); }}
                      className="text-xs text-slate-500 hover:text-slate-300"
                    >
                      Use a different email
                    </button>
                  </form>
                )}
              </div>
            </>
          )}

          {/* Sign up link */}
          <p className="mt-6 text-center text-sm text-slate-400">
            Don't have an account?{' '}
            <Link to="/signup" className="font-bold text-orange-400 hover:text-orange-300 transition-colors">
              Sign up
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="mt-6 text-xs text-slate-600 font-mono text-center leading-relaxed">
          🔒 Your code is private. We only use your profile for sign-in and statistics.
        </p>
      </div>
    </div>
  );
};

export default Login;