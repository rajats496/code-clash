import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppShell from '../components/layout/AppShell';
import MatchChatModal from '../components/chat/MatchChatModal';
import MatchDetailModal from '../components/arena/MatchDetailModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const MatchHistory = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [detailMatchId, setDetailMatchId] = useState(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchHistory = async () => {
      try {
        const res = await fetch(`${API_URL}/api/matches/history`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        if (data.success) {
          setMatches(data.matches);
        } else {
          setError('Failed to load match history.');
        }
      } catch (err) {
        setError('Network error. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [user, token, navigate]);

  // Auto-open chat if navigated from a notification
  useEffect(() => {
    const roomId = location.state?.openChatRoomId;
    if (!roomId || loading || matches.length === 0) return;
    const target = matches.find((m) => m.roomId === roomId);
    if (target) {
      setSelectedMatch(target);
      // Clear state so refreshing doesn't re-open it
      window.history.replaceState({}, '');
    }
  }, [location.state, loading, matches]);

  const isWin = (match) =>
    match.winner?._id?.toString() === (user?.id || user?._id)?.toString();

  const formatDuration = (seconds) => {
    if (!seconds) return '--:--';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  };

  const getOpponent = (match) =>
    match.players?.find((player) => player.user?._id?.toString() !== (user?.id || user?._id)?.toString());

  return (
    <AppShell>
      <main className="max-w-[1200px] mx-auto p-6 pb-14 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--lc-text-bright)] mb-2">
            Match History
          </h1>
          <p className="text-sm text-[var(--lc-text-primary)] font-mono">
            Your recent matches and performance metrics
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-[var(--lc-text-primary)] font-mono text-sm">
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading matches...
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-700/40 bg-red-900/20 p-6 text-center">
            <p className="text-red-400 font-mono text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && matches.length === 0 && (
          <div className="rounded-lg border border-[var(--lc-border)] bg-[var(--lc-card)] lc-card flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-[var(--lc-accent-orange)]/10 border border-[var(--lc-accent-orange)]/20 rounded-lg flex items-center justify-center mb-4">
              <span className="text-3xl">📊</span>
            </div>
            <h3 className="text-[var(--lc-text-bright)] font-bold text-lg mb-2">No matches yet</h3>
            <p className="text-[var(--lc-text-primary)] text-sm font-mono mb-6 max-w-xs">
              Play your first match to see your history here. Good luck!
            </p>
            <a href="/matchmaking" className="lc-btn-primary px-6 py-2 rounded-lg text-sm font-mono font-bold">
              Find a Match
            </a>
          </div>
        )}

        {!loading && !error && matches.length > 0 && (
          <div className="space-y-3">
            {matches.map((match, index) => {
              const won = isWin(match);
              const opponent = getOpponent(match);
              const isPrivate = match.isPrivate;
              const rounds = match.totalRounds || 1;

              return (
                <div
                  key={match._id || index}
                  className={`group rounded-xl border px-5 py-4 flex items-center gap-4 cursor-default transition-all duration-200 lc-card
                    ${won
                      ? 'border-emerald-700/40 bg-emerald-900/10 hover:bg-emerald-900/25 hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-900/30'
                      : 'border-red-700/40 bg-red-900/10 hover:bg-red-900/25 hover:border-red-500/60 hover:shadow-lg hover:shadow-red-900/30'
                    }`}
                >
                  {/* Result stripe */}
                  <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${won ? 'bg-emerald-500' : 'bg-red-500'}`} />

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-[var(--lc-text-bright)] font-semibold truncate">
                        {match.problems?.length > 1
                          ? `${match.problems.length}-Round Match`
                          : match.problem?.title || match.problems?.[0]?.title || 'Unknown problem'}
                      </h3>
                      {/* Private / Ranked badge */}
                      {isPrivate ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 border border-purple-500/40 text-purple-300 flex-shrink-0">
                          🔒 Private
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/15 border border-orange-500/40 text-orange-300 flex-shrink-0">
                          🏆 Ranked
                        </span>
                      )}
                      {/* Rounds badge */}
                      {rounds > 1 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700/60 border border-slate-600/50 text-slate-300 flex-shrink-0">
                          Bo{rounds}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--lc-text-primary)] font-mono flex items-center gap-2 flex-wrap">
                      <span>{formatDate(match.createdAt)}</span>
                      <span className="text-[var(--lc-border)]">·</span>
                      <span>vs <span className="text-[var(--lc-text-bright)] font-semibold">{opponent?.user?.name?.split(' ')[0] || 'Opponent'}</span></span>
                      <span className="text-[var(--lc-border)]">·</span>
                      <span>⏱ {formatDuration(match.duration)}</span>
                    </p>
                  </div>

                  {/* Right side */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs font-black font-mono tracking-wider px-3 py-1 rounded-lg border ${won
                      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                      : 'text-red-400 bg-red-500/10 border-red-500/30'
                      }`}>
                      {won ? '✓ WIN' : '✗ LOSS'}
                    </span>
                    {/* Details button */}
                    <button
                      onClick={() => setDetailMatchId(match._id)}
                      className="px-3 py-2 bg-slate-700/60 hover:bg-slate-600/70 text-slate-200 font-bold rounded-xl border border-slate-500/40 hover:border-slate-400/60 active:scale-95 transition-all text-xs flex items-center gap-1.5 whitespace-nowrap opacity-80 group-hover:opacity-100"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6M3 3h18v18H3V3z" />
                      </svg>
                      Details
                    </button>
                    {/* Chat button */}
                    <button
                      onClick={() => setSelectedMatch(match)}
                      className="px-3 py-2 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500 text-white font-bold rounded-xl border border-blue-400/40 hover:shadow-lg hover:shadow-blue-500/50 hover:from-blue-600 hover:to-blue-400 active:scale-95 transition-all text-xs flex items-center gap-1.5 whitespace-nowrap opacity-80 group-hover:opacity-100"
                    >
                      <svg className="w-3.5 h-3.5 text-blue-100" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 10.5h9m-9 3h5.25M21 12c0 4.97-4.03 9-9 9-1.33 0-2.6-.29-3.75-.8L3 21l.8-5.25A8.96 8.96 0 013 12c0-4.97 4.03-9 9-9s9 4.03 9 9z" />
                      </svg>
                      Chat
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <MatchChatModal
        match={selectedMatch}
        opponent={selectedMatch && getOpponent(selectedMatch)}
        isOpen={!!selectedMatch}
        onClose={() => setSelectedMatch(null)}
      />

      <MatchDetailModal
        matchId={detailMatchId}
        isOpen={!!detailMatchId}
        onClose={() => setDetailMatchId(null)}
      />
    </AppShell>
  );
};

export default MatchHistory;

