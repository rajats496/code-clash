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
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pt-8 pb-20">
        <div className="max-w-6xl mx-auto px-6">
          {/* Header */}
          <div className="mb-10">
            <h1 className="text-4xl font-bold text-white mb-3">Leaderboard</h1>
            <p className="text-slate-400 text-sm">Rank up by winning matches and climb the global rankings</p>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full border-4 border-slate-700 border-t-blue-500 animate-spin mx-auto mb-4" />
                <p className="text-slate-400">Loading leaderboard...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-6 text-center">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && leaderboard.length === 0 && (
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-12 text-center">
              <p className="text-slate-400 text-sm">No players yet</p>
            </div>
          )}

          {/* Leaderboard Table */}
          {!loading && !error && leaderboard.length > 0 && (
            <div className="rounded-lg border border-slate-700/50 overflow-hidden bg-slate-800/30">
              {/* Header Row */}
              <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-4 bg-slate-900/80 border-b border-slate-700/50">
                <div className="col-span-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rank</div>
                <div className="col-span-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">User</div>
                <div className="col-span-2 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Rating</div>
                <div className="col-span-2 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Stats</div>
                <div className="col-span-1 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Win%</div>
              </div>

              {/* Rows */}
              {leaderboard.map((player, index) => {
                const winRate = player.totalMatches > 0 ? Math.round((player.wins / player.totalMatches) * 100) : 0;
                const isCurrentUser = user?._id === player._id;
                const isTopThree = index < 3;

                return (
                  <div
                    key={player._id}
                    className={`grid grid-cols-2 lg:grid-cols-12 gap-4 px-6 py-4 border-b border-slate-700/50 items-center transition-colors ${
                      isCurrentUser
                        ? 'bg-blue-600/15'
                        : isTopThree
                        ? 'hover:bg-slate-700/10 bg-gradient-to-r from-slate-800/50 to-slate-900/30'
                        : 'hover:bg-slate-700/5'
                    }`}
                  >
                    {/* Rank */}
                    <div className="col-span-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0
                          ? 'bg-yellow-500/30 text-yellow-300'
                          : index === 1
                          ? 'bg-slate-400/30 text-slate-200'
                          : index === 2
                          ? 'bg-orange-500/30 text-orange-300'
                          : 'bg-slate-700/30 text-slate-400'
                      }`}>
                        {index < 3 ? ['🥇', '🥈', '🥉'][index] : index + 1}
                      </div>
                    </div>

                    {/* User Info */}
                    <div className="col-span-1 lg:col-span-6 flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-slate-700 border border-slate-600/50 flex items-center justify-center">
                        {player.picture ? (
                          <img src={player.picture} alt={player.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-slate-300">{(player.name?.[0] || 'U').toUpperCase()}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-white truncate">{player.name}</p>
                          {isCurrentUser && <span className="text-xs px-2 py-1 bg-blue-600/40 text-blue-300 rounded-full font-semibold">You</span>}
                        </div>
                        <p className="text-xs text-slate-500 truncate">{player.email}</p>
                      </div>
                    </div>

                    {/* Rating */}
                    <div className="col-span-1 lg:col-span-2 text-center">
                      <p className="font-bold text-white">{player.rating || 1200}</p>
                    </div>

                    {/* Matches/Wins */}
                    <div className="col-span-1 lg:col-span-2 text-center">
                      <p className="font-bold text-white">{player.wins}/{player.totalMatches}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Win/Total</p>
                    </div>

                    {/* Win Rate */}
                    <div className="col-span-1 lg:col-span-1 text-right">
                      <p className="font-bold text-white">{winRate}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Stats Summary */}
          {!loading && !error && leaderboard.length > 0 && (
            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-6">
                <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold mb-2">Top Rated</p>
                <p className="text-2xl font-bold text-white mb-1">{leaderboard[0]?.rating || 0}</p>
                <p className="text-sm text-slate-400 truncate">{leaderboard[0]?.name}</p>
              </div>
              <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-6">
                <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold mb-2">Most Wins</p>
                <p className="text-2xl font-bold text-white mb-1">{Math.max(...leaderboard.map(p => p.wins || 0))}</p>
                <p className="text-sm text-slate-400 truncate">
                  {leaderboard.find(p => p.wins === Math.max(...leaderboard.map(pl => pl.wins || 0)))?.name}
                </p>
              </div>
              <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-6">
                <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold mb-2">Best Win Rate</p>
                <p className="text-2xl font-bold text-white mb-1">
                  {Math.max(...leaderboard.map(p => (p.totalMatches > 0 ? Math.round((p.wins / p.totalMatches) * 100) : 0)))}%
                </p>
                <p className="text-sm text-slate-400 truncate">
                  {leaderboard.find(p => (p.totalMatches > 0 ? Math.round((p.wins / p.totalMatches) * 100) : 0) === Math.max(...leaderboard.map(pl => (pl.totalMatches > 0 ? Math.round((pl.wins / pl.totalMatches) * 100) : 0))))?.[
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
