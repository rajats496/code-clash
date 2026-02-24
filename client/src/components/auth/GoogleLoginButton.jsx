import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

/* ── Inner button (needs GoogleOAuthProvider context) ─────── */
const GoogleButton = () => {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError('');
    // Send credential (ID token) to backend
    const result = await loginWithGoogle(credentialResponse.credential, 'id_token');
    setLoading(false);
    if (result.success) {
      navigate('/matchmaking');
    } else {
      setError(result.error || 'Google login failed');
    }
  };

  const handleError = () => {
    setError('Google login was cancelled or failed');
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-center">
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={handleError}
          theme="filled_black"
          size="large"
          width="380"
          text="continue_with"
          shape="rectangular"
        />
      </div>

      {loading && (
        <div className="flex justify-center">
          <div className="w-5 h-5 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
        </div>
      )}

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