import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

/* ── Google "G" logo as inline SVG ────────────────────────── */
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 1 12c0 1.94.46 3.77 1.18 5.07l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

/* ── Inner button (needs GoogleOAuthProvider context) ─────── */
const GoogleButton = () => {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setError('');
      // Send access_token to backend
      const result = await loginWithGoogle(tokenResponse.access_token, 'access_token');
      setLoading(false);
      if (result.success) {
        navigate('/matchmaking');
      } else {
        setError(result.error || 'Google login failed');
      }
    },
    onError: () => {
      setError('Google login was cancelled or failed');
    },
  });

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => { setError(''); login(); }}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl
          bg-slate-900/80 border border-slate-600/50
          text-sm font-semibold text-slate-200
          hover:bg-slate-800/90 hover:border-slate-500/70 hover:text-white
          active:scale-[0.98] disabled:opacity-50
          transition-all duration-200 cursor-pointer
          shadow-md shadow-black/20 hover:shadow-lg hover:shadow-black/30"
      >
        {loading ? (
          <div className="w-5 h-5 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
        ) : (
          <GoogleIcon />
        )}
        <span>{loading ? 'Signing in…' : 'Continue with Google'}</span>
      </button>

      {error && (
        <p className="text-xs text-red-400 text-center font-medium">{error}</p>
      )}
    </div>
  );
};

/* ── Exported wrapper provides OAuth context ─────────────── */
const GoogleLoginButton = () => (
  <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
    <GoogleButton />
  </GoogleOAuthProvider>
);

export default GoogleLoginButton;