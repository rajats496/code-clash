import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppShell from '../components/layout/AppShell';
import { MedalIcon, DiamondIcon, CrownIcon } from '../components/common/Icons';

const getTier = (r) => {
  if (!r || r < 1200) return { label: 'Bronze', icon: <MedalIcon size={20} className="text-[#ffa116]" />, next: 1200, min: 0, bar: 'var(--lc-accent-orange)', text: 'text-[#ffa116]', badge: 'bg-[#ffa116]/10 border-[#ffa116]/30 text-[#ffa116]' };
  if (r < 1400) return { label: 'Silver', icon: <MedalIcon size={20} className="text-[#9ca3af]" />, next: 1400, min: 1200, bar: '#9ca3af', text: 'text-[#9ca3af]', badge: 'bg-[#9ca3af]/10 border-[#9ca3af]/30 text-[#9ca3af]' };
  if (r < 1600) return { label: 'Gold', icon: <MedalIcon size={20} className="text-[#fbbf24]" />, next: 1600, min: 1400, bar: '#fbbf24', text: 'text-[#fbbf24]', badge: 'bg-[#fbbf24]/10 border-[#fbbf24]/30 text-[#fbbf24]' };
  if (r < 1800) return { label: 'Platinum', icon: <DiamondIcon size={20} className="text-[#22d3ee]" />, next: 1800, min: 1600, bar: '#22d3ee', text: 'text-[#22d3ee]', badge: 'bg-[#22d3ee]/10 border-[#22d3ee]/30 text-[#22d3ee]' };
  return { label: 'Diamond', icon: <CrownIcon size={20} className="text-[#c084fc]" />, next: 2000, min: 1800, bar: '#c084fc', text: 'text-[#c084fc]', badge: 'bg-[#c084fc]/10 border-[#c084fc]/30 text-[#c084fc]' };
};

const Profile = () => {
  const { user, isAuthenticated, refreshUser, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
    else refreshUser();
  }, [isAuthenticated, navigate, refreshUser]);

  if (!user) return null;

  const rating = user.rating || 1200;
  const played = user.matchesPlayed || 0;
  const wins = user.matchesWon || 0;
  const losses = played - wins;
  const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;
  const tier = getTier(rating);
  const tierPct = Math.min(100, Math.round(((rating - tier.min) / (tier.next - tier.min)) * 100));
  const initials = (user.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const formatDate = (d) => d
    ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'N/A';

  return (
    <AppShell>
      <div className="min-h-screen pt-8 pb-20">
        <div className="max-w-3xl mx-auto px-6">

          {/* ── Header ── */}
          <div className="mb-10">
            <h1 className="text-3xl font-bold text-white mb-2">My Profile</h1>
            <p className="text-[var(--lc-text-primary)] text-sm">Your competitive coding identity on CodeClash</p>
          </div>

          {/* ── Profile Card ── */}
          <div className="lc-card mb-6">
            {/* Header row */}
            <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-4 border-b" style={{ borderColor: 'var(--lc-border)' }}>
              <div className="col-span-6 text-xs font-semibold text-[var(--lc-text-primary)] uppercase tracking-wider">Player</div>
              <div className="col-span-2 text-xs font-semibold text-[var(--lc-text-primary)] uppercase tracking-wider text-center">Rating</div>
              <div className="col-span-2 text-xs font-semibold text-[var(--lc-text-primary)] uppercase tracking-wider text-center">Record</div>
              <div className="col-span-2 text-xs font-semibold text-[var(--lc-text-primary)] uppercase tracking-wider text-right">Win Rate</div>
            </div>

            {/* Profile row */}
            <div className="grid grid-cols-2 lg:grid-cols-12 gap-4 px-6 py-5 items-center">
              {/* Avatar + Name */}
              <div className="col-span-2 lg:col-span-6 flex items-center gap-4 min-w-0">
                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border" style={{ borderColor: 'var(--lc-border)' }}>
                  {user.picture
                    ? <img src={user.picture} alt={user.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-gray-600 flex items-center justify-center text-xl font-bold text-white">{initials}</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-bold text-lg text-[var(--lc-text-bright)] truncate">{user.name}</p>
                    <span className="text-[10px] px-2 py-0.5 bg-[var(--lc-accent-orange)]/10 text-[var(--lc-accent-orange)] rounded border border-[var(--lc-accent-orange)]/30 font-semibold">You</span>
                    {isAdmin && (
                      <span className="text-[10px] px-2 py-0.5 bg-red-500/10 border border-red-500/30 text-red-500 rounded font-semibold">Admin</span>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${tier.badge}`}>
                      {tier.icon} {tier.label}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--lc-text-primary)] truncate">{user.email}</p>
                  <p className="text-[10px] text-[var(--lc-text-primary)] mt-1">Member since {formatDate(user.createdAt)}</p>
                </div>
              </div>

              {/* Rating */}
              <div className="col-span-1 lg:col-span-2 text-center">
                <p className="font-bold text-[var(--lc-text-bright)] text-lg">{rating}</p>
                <p className={`text-xs font-semibold mt-0.5 ${tier.text}`}>{tier.label}</p>
              </div>

              {/* Record */}
              <div className="col-span-1 lg:col-span-2 text-center">
                <p className="font-bold text-[var(--lc-text-bright)] text-lg">{wins}/{played}</p>
                <p className="text-xs text-[var(--lc-text-primary)] mt-0.5">Win/Total</p>
              </div>

              {/* Win Rate */}
              <div className="col-span-2 lg:col-span-2 text-right">
                <p className={`font-bold text-lg ${winRate >= 50 ? 'text-[var(--lc-accent-green)]' : 'text-red-500'}`}>{winRate}%</p>
              </div>
            </div>

            {/* Tier progress */}
            <div className="px-6 py-4 border-t" style={{ borderColor: 'var(--lc-border)' }}>
              <div className="flex justify-between text-xs text-[var(--lc-text-primary)] mb-2">
                <span>Tier progress — {tier.label}</span>
                <span>{tierPct}% · {tier.next - rating} pts to {
                  tier.label === 'Bronze' ? 'Silver' : tier.label === 'Silver' ? 'Gold' :
                    tier.label === 'Gold' ? 'Platinum' : tier.label === 'Platinum' ? 'Diamond' : 'Max'
                }</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden bg-[#3e3e3e]">
                <div className="h-full transition-all duration-700" style={{ width: `${tierPct}%`, backgroundColor: tier.bar }} />
              </div>
            </div>
          </div>

          {/* ── Stats Summary ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="lc-card p-6">
              <p className="text-[var(--lc-text-primary)] text-xs uppercase tracking-wider font-semibold mb-2">Matches Played</p>
              <p className="text-2xl font-bold text-[var(--lc-text-bright)] mb-1">{played}</p>
              <p className="text-xs text-[var(--lc-text-primary)]">{wins} wins · {losses} losses</p>
            </div>
            <div className="lc-card p-6">
              <p className="text-[var(--lc-text-primary)] text-xs uppercase tracking-wider font-semibold mb-2">Current Rating</p>
              <p className={`text-2xl font-bold mb-1 ${tier.text}`}>{rating}</p>
              <p className="text-xs text-[var(--lc-text-primary)]">{tier.icon} {tier.label} tier</p>
            </div>
            <div className="lc-card p-6">
              <p className="text-[var(--lc-text-primary)] text-xs uppercase tracking-wider font-semibold mb-2">Win Rate</p>
              <p className={`text-2xl font-bold mb-1 ${winRate >= 50 ? 'text-[var(--lc-accent-green)]' : 'text-red-500'}`}>{winRate}%</p>
              <p className="text-xs text-[var(--lc-text-primary)]">{played > 0 ? `${wins} of ${played} battles won` : 'No matches yet'}</p>
            </div>
          </div>

          {/* ── W/L Breakdown ── */}
          {played > 0 && (
            <div className="lc-card mb-6">
              <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--lc-border)' }}>
                <p className="text-xs font-semibold text-[var(--lc-text-primary)] uppercase tracking-wider">Performance Breakdown</p>
              </div>
              <div className="px-6 py-5">
                <div className="flex items-center gap-4 mb-3">
                  <span className="text-sm text-[var(--lc-accent-green)] font-semibold w-12">{winRate}%</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden flex bg-[#3e3e3e]">
                    <div className="h-full transition-all duration-700" style={{ width: `${winRate}%`, backgroundColor: 'var(--lc-accent-green)' }} />
                    <div className="h-full transition-all duration-700" style={{ width: `${100 - winRate}%`, backgroundColor: '#ef4444' }} />
                  </div>
                  <span className="text-sm text-red-500 font-semibold w-12 text-right">{100 - winRate}%</span>
                </div>
                <div className="flex justify-between text-xs text-[var(--lc-text-primary)]">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: 'var(--lc-accent-green)' }} /> {wins} Wins</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> {losses} Losses</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Quick Actions ── */}
          <div className="lc-card overflow-hidden">
            <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--lc-border)' }}>
              <p className="text-xs font-semibold text-[var(--lc-text-primary)] uppercase tracking-wider">Quick Actions</p>
            </div>
            {[
              { to: '/history', icon: 'history', label: 'Match History', sub: 'View all your past battles', color: 'text-[var(--lc-accent-orange)]' },
              { to: '/leaderboard', icon: 'leaderboard', label: 'Global Leaderboard', sub: 'See where you stand globally', color: 'text-[var(--lc-accent-yellow)]' },
              { to: '/matchmaking', icon: 'sports_esports', label: 'Join a Match', sub: 'Start a 1v1 coding battle now', color: 'text-[var(--lc-accent-green)]' },
              { to: '/friends', icon: 'group', label: 'Friends', sub: 'Manage your friend list', color: 'text-[#8b5cf6]' },
            ].map((a, i, arr) => (
              <Link
                key={a.to}
                to={a.to}
                className={`flex items-center gap-4 px-6 py-4 hover:bg-white/5 transition-colors no-underline group ${i < arr.length - 1 ? 'border-b' : ''}`}
                style={{ borderColor: i < arr.length - 1 ? 'var(--lc-border)' : undefined }}
              >
                <span className={`material-symbols-outlined text-xl ${a.color}`}>{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[var(--lc-text-bright)]">{a.label}</p>
                  <p className="text-xs text-[var(--lc-text-primary)]">{a.sub}</p>
                </div>
                <span className="material-symbols-outlined text-[var(--lc-text-primary)] group-hover:text-[var(--lc-text-bright)] transition-colors text-lg">chevron_right</span>
              </Link>
            ))}
          </div>

        </div>
      </div>
    </AppShell>
  );
};

export default Profile;
