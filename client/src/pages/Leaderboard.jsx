import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AppShell from '../components/layout/AppShell';
import api from '../services/api';

const Leaderboard = () => {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        const response = await api.get('/users/leaderboard');
        console.log('Leaderboard data:', response.data);
        setLeaderboard(response.data || []);
      } catch (err) {
        console.error('Failed to load leaderboard:', err);
        setError('Failed to load leaderboard. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  return (
    <AppShell>
      <div className="min-h-screen pt-8 pb-20" style={{ backgroundColor: 'var(--lc-bg)' }}>
        <div className="max-w-6xl mx-auto px-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
              Global Leaderboard
            </h1>
            <p className="text-[var(--lc-text-primary)] text-sm max-w-2xl leading-relaxed">
              Rank up by winning matches and climb the global ranking ladder.
            </p>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="w-10 h-10 rounded-full border-4 border-[var(--lc-border)] border-t-[var(--lc-accent-orange)] animate-spin mx-auto mb-4" />
                <p className="text-[var(--lc-text-primary)] text-sm">Loading leaderboard...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-center">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && leaderboard.length === 0 && (
            <div className="lc-card p-12 text-center rounded-lg border" style={{ borderColor: 'var(--lc-border)' }}>
              <p className="text-[var(--lc-text-primary)] text-sm">No players yet. Be the first to join a clash!</p>
            </div>
          )}

          {/* Leaderboard Table Grid */}
          {!loading && !error && leaderboard.length > 0 && (
            <div className="lc-card rounded-xl overflow-hidden shadow-lg border" style={{ borderColor: 'var(--lc-border)' }}>
              {/* Header Row */}
              <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-4 border-b bg-[#2a2a2a]/60" style={{ borderColor: 'var(--lc-border)' }}>
                <div className="col-span-1 text-xs font-bold text-[var(--lc-text-primary)] uppercase tracking-wider text-center">Rank</div>
                <div className="col-span-6 text-xs font-bold text-[var(--lc-text-primary)] uppercase tracking-wider">Player</div>
                <div className="col-span-2 text-xs font-bold text-[var(--lc-text-primary)] uppercase tracking-wider text-right">Rating</div>
                <div className="col-span-2 text-xs font-bold text-[var(--lc-text-primary)] uppercase tracking-wider text-center">W / D / L (Total)</div>
                <div className="col-span-1 text-xs font-bold text-[var(--lc-text-primary)] uppercase tracking-wider text-right">Win Rates</div>
              </div>

              {/* Rows */}
              <div className="divide-y" style={{ borderColor: 'var(--lc-border)' }}>
                {leaderboard.map((player, index) => {
                  const winRate = player.totalMatches > 0 ? ((player.wins / player.totalMatches) * 100).toFixed(1) : 0;
                  const isCurrentUser = user?._id === player._id;

                  // Simple medals for top 3
                  const getMedal = (idx) => {
                    if (idx === 0) return { icon: '🥇', bg: 'bg-[#ffc01e]/20', color: 'text-[#ffc01e]' };
                    if (idx === 1) return { icon: '🥈', bg: 'bg-slate-300/20', color: 'text-slate-300' };
                    if (idx === 2) return { icon: '🥉', bg: 'bg-[#c2410c]/20', color: 'text-[#c2410c]' };
                    return { icon: idx + 1, bg: 'bg-[#2a2a2a]', color: 'text-[var(--lc-text-primary)]' };
                  };

                  const rankStyles = getMedal(index);

                  return (
                    <div
                      key={player._id}
                      className={`grid grid-cols-2 lg:grid-cols-12 gap-4 px-6 py-4 items-center transition-colors ${isCurrentUser ? 'bg-[var(--lc-accent-orange)]/10' : 'hover:bg-white/5'
                        }`}
                    >
                      {/* Rank */}
                      <div className="col-span-1 flex justify-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${rankStyles.bg} ${rankStyles.color}`}>
                          {rankStyles.icon}
                        </div>
                      </div>

                      {/* User Info */}
                      <div className="col-span-1 lg:col-span-6 flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full flex-shrink-0 bg-gray-600 overflow-hidden">
                          {player.picture ? (
                            <img src={player.picture} alt={player.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-white font-bold">
                              {(player.name?.[0] || 'U').toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-[var(--lc-text-bright)] truncate">
                              {isCurrentUser ? 'You' : player.name}
                            </p>
                            {isCurrentUser && (
                              <span className="text-[10px] px-2 py-0.5 bg-[var(--lc-accent-orange)] text-black rounded font-bold uppercase tracking-wider">
                                Current
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--lc-text-primary)] truncate">{player.email}</p>
                        </div>
                      </div>

                      {/* Rating */}
                      <div className="col-span-1 lg:col-span-2 text-right">
                        <span className="text-base font-bold text-[var(--lc-accent-orange)]">
                          {(player.rating || 1200).toLocaleString()}
                        </span>
                        <span className="text-xs text-[var(--lc-text-primary)] ml-1">pts</span>
                      </div>

                      {/* Matches/Wins */}
                      <div className="col-span-1 lg:col-span-2 text-center text-sm">
                        <span className="text-[var(--lc-accent-green)] font-semibold">{player.wins}</span>
                        <span className="text-[var(--lc-text-primary)] mx-1">/</span>
                        <span className="text-[var(--lc-text-bright)] font-semibold">{player.totalMatches}</span>
                      </div>

                      {/* Win Rate */}
                      <div className="col-span-1 lg:col-span-1 text-right">
                        <span className="text-sm font-bold text-[var(--lc-text-bright)]">{winRate}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stats Summary Panel */}
          {!loading && !error && leaderboard.length > 0 && (
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="lc-card p-5 rounded-lg border flex flex-col items-start" style={{ borderColor: 'var(--lc-border)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">👑</span>
                  <p className="text-xs text-[var(--lc-text-primary)] uppercase tracking-wider font-semibold">Highest Rating</p>
                </div>
                <p className="text-2xl font-bold text-white mb-1">{(leaderboard[0]?.rating || 0).toLocaleString()} pts</p>
                <p className="text-sm text-[var(--lc-text-primary)] truncate">{leaderboard[0]?.name}</p>
              </div>

              <div className="lc-card p-5 rounded-lg border flex flex-col items-start" style={{ borderColor: 'var(--lc-border)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">⚔️</span>
                  <p className="text-xs text-[var(--lc-text-primary)] uppercase tracking-wider font-semibold">Most Battles Won</p>
                </div>
                <p className="text-2xl font-bold text-[var(--lc-accent-orange)] mb-1">{Math.max(...leaderboard.map(p => p.wins || 0))}</p>
                <p className="text-sm text-[var(--lc-text-primary)] truncate">
                  {leaderboard.find(p => p.wins === Math.max(...leaderboard.map(pl => pl.wins || 0)))?.name}
                </p>
              </div>

              <div className="lc-card p-5 rounded-lg border flex flex-col items-start" style={{ borderColor: 'var(--lc-border)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">📈</span>
                  <p className="text-xs text-[var(--lc-text-primary)] uppercase tracking-wider font-semibold">Top Win Rate</p>
                </div>
                <p className="text-2xl font-bold text-[var(--lc-accent-green)] mb-1">
                  {Math.max(...leaderboard.map(p => (p.totalMatches > 0 ? ((p.wins / p.totalMatches) * 100) : 0))).toFixed(1)}%
                </p>
                <p className="text-sm text-[var(--lc-text-primary)] truncate">
                  {leaderboard.find(p => (p.totalMatches > 0 ? ((p.wins / p.totalMatches) * 100) : 0) === Math.max(...leaderboard.map(pl => (pl.totalMatches > 0 ? ((pl.wins / pl.totalMatches) * 100) : 0))))?.[
                    'name'
                  ]}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
};

export default Leaderboard;
