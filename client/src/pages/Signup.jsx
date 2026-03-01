import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GoogleLoginButton from '../components/auth/GoogleLoginButton';
import { SwordsIcon, SparklesIcon } from '../components/common/Icons';

const Signup = () => {
  const { isAuthenticated, registerWithEmail, verifySignupOtp, resendSignupOtp } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('user');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState('form');
  const [pendingEmail, setPendingEmail] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate('/matchmaking');
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name || !email || !password) {
      setError('Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    const result = await registerWithEmail({ name, email, password, role });
    setLoading(false);

    if (result.success) {
      setPendingEmail(result.email || email);
      setStep('otp');
      setOtpValue('');
      setError('');
    } else {
      setError(result.error);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    if (!otpValue.trim() || otpValue.length !== 6) {
      setError('Enter the 6-digit code from your email');
      return;
    }
    setOtpLoading(true);
    const result = await verifySignupOtp(pendingEmail, otpValue.trim());
    setOtpLoading(false);
    if (result.success) {
      navigate('/matchmaking');
    } else {
      setError(result.error);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setResendLoading(true);
    const result = await resendSignupOtp(pendingEmail);
    setResendLoading(false);
    if (result.success) {
      setOtpValue('');
      setError('');
    } else {
      setError(result.error);
    }
  };

  const inputClasses = "w-full bg-slate-900/60 border border-slate-600/50 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30 transition-all";

  // Password strength indicator
  const getStrength = () => {
    if (!password) return { width: '0%', color: 'bg-slate-700', label: '' };
    if (password.length < 6) return { width: '25%', color: 'bg-red-500', label: 'Weak' };
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    const score = [password.length >= 8, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
    if (score <= 1) return { width: '40%', color: 'bg-orange-500', label: 'Fair' };
    if (score <= 2) return { width: '65%', color: 'bg-yellow-500', label: 'Good' };
    return { width: '100%', color: 'bg-emerald-500', label: 'Strong' };
  };

  const strength = getStrength();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/3 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl" />
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
            Create your account & start battling
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8 bg-slate-800/40 border border-slate-700/50 backdrop-blur shadow-2xl shadow-black/20">
          <h2 className="text-xl font-bold text-slate-50 mb-1">Create Account</h2>
          <p className="text-sm text-slate-400 mb-6">Join thousands of competitive coders</p>

          {error && (
            <div className="p-3 rounded-xl text-sm font-medium flex items-center gap-2 mb-5 bg-red-500/10 border border-red-500/30 text-red-400">
              <span>⚠️</span> {error}
            </div>
          )}

          {step === 'otp' ? (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <p className="text-sm text-slate-400">We sent a verification code to <strong className="text-slate-300">{pendingEmail}</strong></p>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                  Verification code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className={inputClasses + ' text-center tracking-[0.3em]'}
                  placeholder="000000"
                  value={otpValue}
                  onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  autoComplete="one-time-code"
                />
              </div>
              <button type="submit" disabled={otpLoading || otpValue.length !== 6}
                className="w-full py-3 rounded-xl text-sm font-bold active:scale-95 transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 disabled:opacity-50 disabled:active:scale-100 relative overflow-hidden group"
                style={{ background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff' }}>
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {otpLoading ? (
                    <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Verifying...</>
                  ) : (
                    <>Verify &amp; Sign in</>
                  )}
                </span>
              </button>
              <p className="text-center text-sm text-slate-400">
                Didn&apos;t receive the code?{' '}
                <button type="button" onClick={handleResendOtp} disabled={resendLoading}
                  className="font-bold text-orange-400 hover:text-orange-300 transition-colors disabled:opacity-50">
                  {resendLoading ? 'Sending...' : 'Resend code'}
                </button>
              </p>
              <button type="button" onClick={() => { setStep('form'); setError(''); setOtpValue(''); }}
                className="text-xs text-slate-500 hover:text-slate-300 w-full text-center">
                Use a different email
              </button>
            </form>
          ) : (
          <>
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
                Display Name
              </label>
              <input type="text" className={inputClasses} placeholder="CodingNinja42"
                value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
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
                  placeholder="Min 6 characters"
                  value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors">
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {/* Strength bar */}
              {password && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
                    <div className={`h-full rounded-full ${strength.color} transition-all duration-300`} style={{ width: strength.width }} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500">{strength.label}</span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                Confirm Password
              </label>
              <input type="password" className={inputClasses}
                placeholder="Re-enter password"
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-400 mt-1 font-medium">Passwords don't match</p>
              )}
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-bold active:scale-95 transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 disabled:opacity-50 disabled:active:scale-100 relative overflow-hidden group"
              style={{ background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff' }}>
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? (
                  <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Creating account...</>
                ) : (
                  <><span className="text-base group-hover:scale-110 transition-transform"><SparklesIcon size={18} /></span> Create Account</>
                )}
              </span>
              <span className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-700 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </form>

          {/* Google Login (Only for Users) */}
          {role === 'user' && step === 'form' && (
            <>
              {/* Divider */}
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-slate-700/50" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-slate-700/50" />
              </div>

              {/* Google */}
              <GoogleLoginButton />
            </>
          )}
          </>
          )}

          {/* Login link */}
          <p className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-orange-400 hover:text-orange-300 transition-colors">
              Sign in
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

export default Signup;
