import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppShell from '../components/layout/AppShell';

const Profile = () => {
  const { user, logout, isAuthenticated, refreshUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    } else {
      // ✅ Refresh user data when page loads
      refreshUser();
    }
  }, [isAuthenticated, navigate, refreshUser]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const winRate = user?.matchesPlayed
    ? ((user.matchesWon / user.matchesPlayed) * 100).toFixed(0)
    : 0;

  const lossRate = user?.matchesPlayed
    ? (((user.matchesPlayed - user.matchesWon) / user.matchesPlayed) * 100).toFixed(0)
    : 0;

  const losses = (user?.matchesPlayed || 0) - (user?.matchesWon || 0);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  };

  if (!user) return null;

  return (
    <AppShell>
      <main className="max-w-[1200px] mx-auto p-6 pb-14 space-y-6">
        {/* Profile Header Card */}
        <div className="rounded-lg border border-[var(--lc-border)] bg-[var(--lc-card)] px-6 py-5 flex items-center gap-5 lc-card">
          <img
            src={user.picture}
            alt={user.name}
            className="w-16 h-16 rounded-lg border border-[var(--lc-border)]"
          />
          <div className="flex-1">
            <h1 className="text-xl font-bold text-[var(--lc-text-bright)] mb-1">
              {user.name}
            </h1>
            <p className="text-sm text-[var(--lc-text-primary)] font-mono">
              {user.email}
            </p>
            <p className="text-xs text-[var(--lc-text-primary)] font-mono mt-2">
              Member since {formatDate(user.createdAt)}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-[var(--lc-text-primary)] uppercase tracking-wide font-mono mb-1">Rating</div>
            <div className="text-2xl font-bold text-[var(--lc-accent-orange)]">
              {user.rating || 1200}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Matches played', value: user.matchesPlayed || 0 },
            { label: 'Wins', value: user.matchesWon || 0 },
            { label: 'Losses', value: losses },
            { label: 'Win rate', value: `${winRate}%` },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-[var(--lc-border)] bg-[var(--lc-card)] px-4 py-4 lc-card"
            >
              <div className="text-xs text-[var(--lc-text-primary)] uppercase tracking-wide font-mono mb-2">
                {item.label}
              </div>
              <div className="text-2xl font-bold text-[var(--lc-text-bright)]">{item.value}</div>
            </div>
          ))}
        </div>

        {/* Navigation Links */}
        <div className="flex gap-3 justify-end">
          <a href="/history" className="lc-nav-link px-4 py-2 border border-[var(--lc-border)] rounded-lg">
            Match history
          </a>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-lg border border-red-700/40 text-red-400 hover:bg-red-900/20 transition-colors text-sm font-mono"
          >
            Log out
          </button>
        </div>
      </main>
    </AppShell>
  );
};

export default Profile;