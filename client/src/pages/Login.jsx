import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GoogleLoginButton from '../components/auth/GoogleLoginButton';
import AppShell from '../components/layout/AppShell';

const Login = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/matchmaking');
    }
  }, [isAuthenticated, navigate]);

  return (
    <AppShell>
      <main className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-lg border border-[var(--lc-border)] bg-[var(--lc-card)] lc-card px-8 py-10">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[var(--lc-text-bright)] mb-2">
              CodeClash
            </h1>
            <p className="text-sm text-[var(--lc-text-primary)] font-mono">
              Compete in real-time 1v1 coding matches. Sign in to get started.
            </p>
          </div>

          <GoogleLoginButton />

          <p className="mt-8 text-xs text-[var(--lc-text-primary)] font-mono text-center leading-relaxed">
            🔒 We only use your profile for sign-in and basic statistics. Your code is private.
          </p>
        </div>
      </main>
    </AppShell>
  );
};

export default Login;